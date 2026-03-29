-- ============================================================
-- Migration 014: Planning assignment RPC
-- Use a security-definer function for planning-board assignment
-- so authenticated users can reliably assign and reassign jobs.
-- ============================================================

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
    status = case when public.jobs.status = 'new' then 'assigned' else public.jobs.status end
  where id = p_job_id;

  return query
  select
    p_tech_id,
    v_queue_position,
    (select jobs.status from public.jobs where jobs.id = p_job_id);
end;
$$;

grant execute on function public.assign_job_planning(uuid, uuid) to authenticated;
