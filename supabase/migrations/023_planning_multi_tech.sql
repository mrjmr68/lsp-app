-- ============================================================
-- Migration 023: Planning multi-tech support
-- Allow planning to manage assist techs through a security-definer
-- RPC while keeping the lead tech on jobs.assigned_tech.
-- ============================================================

create or replace function public.set_job_planning_assists(
  p_job_id uuid,
  p_assist_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_assist_ids uuid[] := '{}'::uuid[];
  v_invalid_count integer := 0;
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

  select coalesce(array_agg(distinct assist_id), '{}'::uuid[])
  into v_assist_ids
  from unnest(coalesce(p_assist_ids, '{}'::uuid[])) as assist_id
  where assist_id is not null
    and assist_id <> v_job.assigned_tech;

  if coalesce(array_length(v_assist_ids, 1), 0) > 0
     and v_job.assigned_tech is null then
    raise exception 'Assign a lead tech before adding assist techs';
  end if;

  select count(*)
  into v_invalid_count
  from unnest(v_assist_ids) as assist_id
  left join public.users u on u.id = assist_id
  where u.id is null
    or u.active is not true
    or u.role not in ('tech', 'dispatcher', 'admin', 'owner');

  if v_invalid_count > 0 then
    raise exception 'Assist tech list contains inactive or invalid users';
  end if;

  delete from public.job_tech
  where job_id = p_job_id
    and role = 'assist'
    and (
      coalesce(array_length(v_assist_ids, 1), 0) = 0
      or not (user_id = any(v_assist_ids))
    );

  if coalesce(array_length(v_assist_ids, 1), 0) > 0 then
    insert into public.job_tech (job_id, user_id, role)
    select p_job_id, assist_id, 'assist'
    from unnest(v_assist_ids) as assist_id
    on conflict (job_id, user_id)
    do update set role = 'assist';
  end if;

  return coalesce(array_length(v_assist_ids, 1), 0);
end;
$$;

grant execute on function public.set_job_planning_assists(uuid, uuid[]) to authenticated;

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

  delete from public.job_tech
  where job_id = p_job_id
    and role = 'assist'
    and user_id = p_tech_id;

  return query
  select
    p_tech_id,
    v_queue_position,
    (select jobs.status from public.jobs where jobs.id = p_job_id);
end;
$$;
