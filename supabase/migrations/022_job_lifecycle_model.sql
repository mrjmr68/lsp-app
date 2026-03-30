-- ============================================================
-- Migration 022: Job lifecycle model
-- Separate operational status, resolution type, and commercial state
-- while keeping legacy jobs.status in sync for existing app paths.
-- ============================================================

alter table public.jobs
  add column if not exists job_status text not null default 'intake'
    check (job_status in (
      'intake',
      'scheduled',
      'dispatched',
      'on_site',
      'follow_up_planning',
      'follow_up_scheduled',
      'follow_up_active',
      'completed',
      'cancelled'
    )),
  add column if not exists resolution_type text
    check (resolution_type in (
      'standard_repair',
      'adhoc_repair',
      'repair_estimate',
      'parts_sourcing',
      'major_repair',
      'install',
      'closed_no_action',
      'monitor_only'
    )),
  add column if not exists commercial_state text not null default 'none'
    check (commercial_state in (
      'none',
      'estimate_needed',
      'estimate_sent',
      'approval_pending',
      'approved',
      'parts_needed',
      'parts_ordered',
      'ready_to_schedule',
      'ready_for_invoice',
      'invoiced'
    ));

create index if not exists jobs_job_status_idx
  on public.jobs (job_status);

create index if not exists jobs_commercial_state_idx
  on public.jobs (commercial_state);

create or replace function public.job_status_from_legacy(p_status text)
returns text
language sql
immutable
as $$
  select case coalesce(p_status, 'new')
    when 'assigned' then 'scheduled'
    when 'en_route' then 'dispatched'
    when 'in_progress' then 'on_site'
    when 'completed' then 'completed'
    when 'closed_no_diagnosis' then 'completed'
    when 'cancelled' then 'cancelled'
    when 'invoiced' then 'completed'
    else 'intake'
  end;
$$;

create or replace function public.commercial_state_from_legacy(p_status text)
returns text
language sql
immutable
as $$
  select case coalesce(p_status, 'new')
    when 'completed' then 'ready_for_invoice'
    when 'invoiced' then 'invoiced'
    else 'none'
  end;
$$;

create or replace function public.legacy_status_from_lifecycle(
  p_job_status text,
  p_commercial_state text,
  p_resolution_type text
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_commercial_state, 'none') = 'invoiced' then 'invoiced'
    when coalesce(p_job_status, 'intake') = 'cancelled' then 'cancelled'
    when coalesce(p_job_status, 'intake') = 'completed' then
      case when p_resolution_type = 'closed_no_action' then 'closed_no_diagnosis' else 'completed' end
    when coalesce(p_job_status, 'intake') in ('on_site', 'follow_up_active') then 'in_progress'
    when coalesce(p_job_status, 'intake') = 'dispatched' then 'en_route'
    when coalesce(p_job_status, 'intake') in ('scheduled', 'follow_up_planning', 'follow_up_scheduled') then 'assigned'
    else 'new'
  end;
$$;

create or replace function public.sync_job_lifecycle_fields()
returns trigger
language plpgsql
as $$
begin
  new.job_status := coalesce(new.job_status, 'intake');
  new.commercial_state := coalesce(new.commercial_state, 'none');

  if tg_op = 'INSERT' then
    if new.status is distinct from 'new'
       and new.job_status = 'intake'
       and new.commercial_state = 'none'
       and new.resolution_type is null then
      new.job_status := public.job_status_from_legacy(new.status);
      new.commercial_state := public.commercial_state_from_legacy(new.status);
      new.resolution_type := case
        when new.status = 'closed_no_diagnosis' then 'closed_no_action'
        when new.workflow_type = 'install' then 'install'
        when new.workflow_type = 'major_repair' then 'major_repair'
        when new.status in ('completed', 'invoiced') and new.diagnosis_id is not null then 'standard_repair'
        else new.resolution_type
      end;
    end if;
  elsif new.status is distinct from old.status
        and new.job_status is not distinct from old.job_status
        and new.commercial_state is not distinct from old.commercial_state
        and new.resolution_type is not distinct from old.resolution_type then
    new.job_status := public.job_status_from_legacy(new.status);
    new.commercial_state := public.commercial_state_from_legacy(new.status);
    new.resolution_type := case
      when new.status = 'closed_no_diagnosis' then 'closed_no_action'
      when new.workflow_type = 'install' then coalesce(new.resolution_type, 'install')
      when new.workflow_type = 'major_repair' then coalesce(new.resolution_type, 'major_repair')
      when new.status in ('completed', 'invoiced') and new.diagnosis_id is not null then coalesce(new.resolution_type, 'standard_repair')
      else new.resolution_type
    end;
  end if;

  if new.commercial_state = 'invoiced' and new.job_status <> 'cancelled' then
    new.job_status := 'completed';
  end if;

  new.status := public.legacy_status_from_lifecycle(new.job_status, new.commercial_state, new.resolution_type);
  return new;
end;
$$;

drop trigger if exists jobs_sync_lifecycle_fields on public.jobs;

create trigger jobs_sync_lifecycle_fields
  before insert or update on public.jobs
  for each row execute procedure public.sync_job_lifecycle_fields();

update public.jobs as jobs
set
  job_status = public.job_status_from_legacy(jobs.status),
  commercial_state = public.commercial_state_from_legacy(jobs.status),
  resolution_type = case
    when jobs.workflow_type = 'install' then 'install'
    when jobs.workflow_type = 'major_repair' then 'major_repair'
    when jobs.status = 'closed_no_diagnosis' then 'closed_no_action'
    when exists (
      select 1
      from public.job_adhoc_bundles
      where public.job_adhoc_bundles.job_id = jobs.id
    ) then 'adhoc_repair'
    when jobs.status in ('completed', 'invoiced') and jobs.diagnosis_id is not null then 'standard_repair'
    else jobs.resolution_type
  end;

create or replace function public.enforce_owner_invoice_job_updates()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_role() <> 'owner' and (
    new.flagged_for_review is distinct from old.flagged_for_review
    or new.flat_rate_override is distinct from old.flat_rate_override
    or new.invoice_number is distinct from old.invoice_number
    or new.invoice_subtotal is distinct from old.invoice_subtotal
    or new.invoice_tax is distinct from old.invoice_tax
    or new.invoice_total is distinct from old.invoice_total
    or new.invoice_amount is distinct from old.invoice_amount
    or new.invoice_pdf_path is distinct from old.invoice_pdf_path
    or new.tax_rate is distinct from old.tax_rate
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or (new.needs_admin_review is distinct from old.needs_admin_review and new.needs_admin_review = false)
    or (new.status is distinct from old.status and new.status = 'invoiced')
    or (new.commercial_state is distinct from old.commercial_state and new.commercial_state = 'invoiced')
  ) then
    raise exception 'Invoice fields can only be updated by the owner.';
  end if;

  return new;
end;
$$;

create or replace function public.assign_job_planning(
  p_job_id uuid,
  p_tech_id uuid
)
returns table (
  assigned_tech uuid,
  queue_position integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_target_user public.users%rowtype;
  v_queue_position integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_job
  from public.jobs
  where id = p_job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  select *
  into v_target_user
  from public.users
  where id = p_tech_id
    and active = true
    and role in ('tech', 'dispatcher', 'admin', 'owner');

  if not found then
    raise exception 'Target assignee is not an active assignable user';
  end if;

  select coalesce(max(j.queue_position), 0) + 1
  into v_queue_position
  from public.jobs j
  where j.assigned_tech = p_tech_id
    and j.job_date = v_job.job_date;

  update public.jobs
  set
    assigned_tech = p_tech_id,
    queue_position = v_queue_position,
    job_status = case
      when public.jobs.job_status = 'intake' then 'scheduled'
      else public.jobs.job_status
    end,
    status = case
      when public.jobs.status = 'new' then 'assigned'
      else public.jobs.status
    end
  where id = p_job_id;

  return query
  select
    p_tech_id,
    v_queue_position,
    (select jobs.status from public.jobs where jobs.id = p_job_id);
end;
$$;
