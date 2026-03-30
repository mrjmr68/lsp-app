-- ============================================================
-- Migration 021: Shared install / major-repair workflows
-- Shared materials, prep, execution, closeout, and job messaging
-- ============================================================

alter table public.jobs
  add column if not exists workflow_type text not null default 'standard'
    check (workflow_type in ('standard', 'install', 'major_repair'));

create or replace function public.can_access_job_workspace(p_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.current_user_role() in ('owner', 'admin', 'dispatcher')
    or exists (
      select 1
      from public.jobs
      where id = p_job_id
        and (
          assigned_tech = auth.uid()
          or actual_tech = auth.uid()
        )
    )
    or exists (
      select 1
      from public.job_tech
      where job_id = p_job_id
        and user_id = auth.uid()
    );
$$;

create table if not exists public.job_workflows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  workflow_type text not null check (workflow_type in ('install', 'major_repair')),
  status text not null default 'prep' check (status in ('prep', 'on_site', 'closeout', 'complete')),
  started_at timestamptz not null default now(),
  started_by uuid references public.users(id),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists job_workflows_job_idx
  on public.job_workflows(job_id);

create table if not exists public.job_workflow_items (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.job_workflows(id) on delete cascade,
  phase text not null check (phase in ('prep', 'materials', 'execution', 'closeout')),
  sort_order integer not null default 0,
  label text not null,
  details text,
  action_key text,
  required boolean not null default true,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists job_workflow_items_workflow_phase_idx
  on public.job_workflow_items(workflow_id, phase, sort_order, created_at);

create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references public.users(id),
  message_type text not null check (message_type in ('text', 'quick_action', 'system')),
  body text not null,
  quick_action_key text,
  created_at timestamptz not null default now()
);

create index if not exists job_messages_job_created_idx
  on public.job_messages(job_id, created_at desc);

alter table public.job_workflows enable row level security;
alter table public.job_workflow_items enable row level security;
alter table public.job_messages enable row level security;

create policy "Read job workflows"
  on public.job_workflows for select
  using (public.can_access_job_workspace(job_id));

create policy "Insert job workflows"
  on public.job_workflows for insert
  with check (public.can_access_job_workspace(job_id));

create policy "Update job workflows"
  on public.job_workflows for update
  using (public.can_access_job_workspace(job_id))
  with check (public.can_access_job_workspace(job_id));

create policy "Read job workflow items"
  on public.job_workflow_items for select
  using (
    exists (
      select 1
      from public.job_workflows
      where public.job_workflows.id = job_workflow_items.workflow_id
        and public.can_access_job_workspace(public.job_workflows.job_id)
    )
  );

create policy "Insert job workflow items"
  on public.job_workflow_items for insert
  with check (
    exists (
      select 1
      from public.job_workflows
      where public.job_workflows.id = job_workflow_items.workflow_id
        and public.can_access_job_workspace(public.job_workflows.job_id)
    )
  );

create policy "Update job workflow items"
  on public.job_workflow_items for update
  using (
    exists (
      select 1
      from public.job_workflows
      where public.job_workflows.id = job_workflow_items.workflow_id
        and public.can_access_job_workspace(public.job_workflows.job_id)
    )
  )
  with check (
    exists (
      select 1
      from public.job_workflows
      where public.job_workflows.id = job_workflow_items.workflow_id
        and public.can_access_job_workspace(public.job_workflows.job_id)
    )
  );

create policy "Read job messages"
  on public.job_messages for select
  using (public.can_access_job_workspace(job_id));

create policy "Insert job messages"
  on public.job_messages for insert
  with check (
    public.can_access_job_workspace(job_id)
    and user_id = auth.uid()
  );

alter table public.job_workflow_items replica identity full;
alter table public.job_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_workflows'
  ) then
    alter publication supabase_realtime add table public.job_workflows;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_workflow_items'
  ) then
    alter publication supabase_realtime add table public.job_workflow_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_messages'
  ) then
    alter publication supabase_realtime add table public.job_messages;
  end if;
end $$;
