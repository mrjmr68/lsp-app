-- ============================================================
-- Migration 028: Service requests and service visits
-- Build 1 transition layer for the v1.0 field-service workflow.
--
-- This preserves legacy jobs while introducing the product language
-- from the current spec: request -> visit -> repair/parts -> invoice-ready.
-- ============================================================

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  created_from_legacy_job_id uuid unique references public.jobs(id) on delete set null,
  parent_request_id uuid references public.service_requests(id) on delete set null,
  request_kind text not null default 'service_call'
    check (request_kind in ('service_call', 'add_unit')),
  billable boolean not null default true,

  customer_id uuid not null references public.customers(id),
  location_id uuid not null references public.locations(id),
  unit_id uuid references public.units(id),
  system_id uuid references public.systems(id),

  source text not null default 'dispatcher'
    check (source in (
      'phone',
      'text',
      'email',
      'web_form',
      'dispatcher',
      'tech_direct',
      'onsite',
      'legacy_import',
      'other'
    )),
  status text not null default 'intake'
    check (status in (
      'intake',
      'scheduled',
      'active',
      'waiting_parts',
      'completed',
      'cancelled'
    )),
  priority text not null default 'routine'
    check (priority in ('routine', 'urgent', 'emergency')),

  problem_description text,
  access_notes text,
  manual_unit text,
  requested_at timestamptz not null default now(),
  requested_by uuid references public.users(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_customer_idx
  on public.service_requests(customer_id);

create index if not exists service_requests_location_status_idx
  on public.service_requests(location_id, status);

create index if not exists service_requests_unit_idx
  on public.service_requests(unit_id);

create index if not exists service_requests_requested_at_idx
  on public.service_requests(requested_at desc);

create table if not exists public.service_visits (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  legacy_job_id uuid unique references public.jobs(id) on delete set null,
  return_for_visit_id uuid references public.service_visits(id) on delete set null,

  visit_sequence integer not null default 1,
  is_initial_visit boolean not null default true,
  billable boolean not null default true,

  assigned_tech uuid references public.users(id),
  actual_tech uuid references public.users(id),
  scheduled_date date,
  queue_position integer,

  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'en_route',
      'on_site',
      'completed',
      'cancelled'
    )),
  outcome text
    check (outcome in (
      'repair_completed',
      'parts_needed',
      'closed_no_action',
      'monitor_only'
    )),
  billing_status text not null default 'not_ready'
    check (billing_status in (
      'not_ready',
      'blocked_parts_return',
      'ready_for_invoice',
      'invoiced',
      'not_billable'
    )),

  access_confirmed boolean not null default false,
  access_confirmation_needed boolean not null default false,
  needs_return_visit boolean not null default false,
  no_invoice_until_return_complete boolean not null default false,

  arrival_notes text,
  field_summary text,
  internal_notes text,

  departed_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (service_request_id, visit_sequence)
);

create index if not exists service_visits_request_idx
  on public.service_visits(service_request_id, visit_sequence);

create index if not exists service_visits_assigned_date_idx
  on public.service_visits(assigned_tech, scheduled_date, queue_position);

create index if not exists service_visits_status_idx
  on public.service_visits(status);

create index if not exists service_visits_billing_status_idx
  on public.service_visits(billing_status);

alter table public.service_requests
  add column if not exists origin_visit_id uuid references public.service_visits(id) on delete set null;

create table if not exists public.visit_notes (
  id uuid primary key default gen_random_uuid(),
  service_visit_id uuid not null references public.service_visits(id) on delete cascade,
  user_id uuid not null references public.users(id),
  note_type text not null default 'general'
    check (note_type in ('general', 'access', 'approval', 'timing', 'status', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists visit_notes_visit_created_idx
  on public.visit_notes(service_visit_id, created_at desc);

create table if not exists public.visit_repairs (
  id uuid primary key default gen_random_uuid(),
  service_visit_id uuid not null references public.service_visits(id) on delete cascade,
  repair_bundle_id uuid references public.repair_bundles(id) on delete set null,
  source text not null default 'catalog'
    check (source in ('catalog', 'adhoc')),
  quantity numeric(8,2) not null default 1,
  repair_code text,
  description_title text not null,
  description_body text,
  customer_description text,
  flat_rate_amount numeric(10,2),
  variable_pricing boolean not null default false,
  template_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(template_snapshot) = 'object'),
  selected_by uuid references public.users(id),
  selected_at timestamptz not null default now()
);

create index if not exists visit_repairs_visit_idx
  on public.visit_repairs(service_visit_id, selected_at);

create table if not exists public.visit_parts_needed (
  id uuid primary key default gen_random_uuid(),
  service_visit_id uuid not null references public.service_visits(id) on delete cascade,
  part_name text not null,
  part_number text,
  quantity numeric(8,2) not null default 1,
  notes text,
  return_visit_required boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists visit_parts_needed_visit_idx
  on public.visit_parts_needed(service_visit_id, created_at);

alter table public.job_invoice_snapshots
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null,
  add column if not exists service_visit_id uuid references public.service_visits(id) on delete set null;

create index if not exists job_invoice_snapshots_service_visit_idx
  on public.job_invoice_snapshots(service_visit_id);

create or replace function public.touch_service_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists service_requests_touch_updated_at on public.service_requests;

create trigger service_requests_touch_updated_at
  before update on public.service_requests
  for each row execute procedure public.touch_service_request_updated_at();

create or replace function public.touch_service_visit_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists service_visits_touch_updated_at on public.service_visits;

create trigger service_visits_touch_updated_at
  before update on public.service_visits
  for each row execute procedure public.touch_service_visit_updated_at();

create or replace function public.can_access_service_request(p_request_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.current_user_role() in ('owner', 'admin', 'dispatcher')
      or exists (
        select 1
        from public.service_requests sr
        where sr.id = p_request_id
          and (sr.created_by = auth.uid() or sr.requested_by = auth.uid())
      )
      or exists (
        select 1
        from public.service_visits sv
        where sv.service_request_id = p_request_id
          and (sv.assigned_tech = auth.uid() or sv.actual_tech = auth.uid())
      )
      or exists (
        select 1
        from public.service_visits sv
        join public.job_tech jt on jt.job_id = sv.legacy_job_id
        where sv.service_request_id = p_request_id
          and jt.user_id = auth.uid()
      )
    );
$$;

create or replace function public.can_access_service_visit(p_visit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.current_user_role() in ('owner', 'admin', 'dispatcher')
      or exists (
        select 1
        from public.service_visits sv
        join public.service_requests sr on sr.id = sv.service_request_id
        where sv.id = p_visit_id
          and (
            sv.assigned_tech = auth.uid()
            or sv.actual_tech = auth.uid()
            or sr.created_by = auth.uid()
            or sr.requested_by = auth.uid()
          )
      )
      or exists (
        select 1
        from public.service_visits sv
        join public.job_tech jt on jt.job_id = sv.legacy_job_id
        where sv.id = p_visit_id
          and jt.user_id = auth.uid()
      )
    );
$$;

alter table public.service_requests enable row level security;
alter table public.service_visits enable row level security;
alter table public.visit_notes enable row level security;
alter table public.visit_repairs enable row level security;
alter table public.visit_parts_needed enable row level security;

drop policy if exists "Read service requests" on public.service_requests;
create policy "Read service requests"
  on public.service_requests for select
  using (public.can_access_service_request(id));

drop policy if exists "Insert service requests" on public.service_requests;
create policy "Insert service requests"
  on public.service_requests for insert
  with check (
    auth.uid() is not null
    and (
      public.current_user_role() in ('owner', 'admin', 'dispatcher', 'tech')
      or created_by = auth.uid()
      or requested_by = auth.uid()
    )
  );

drop policy if exists "Update service requests" on public.service_requests;
create policy "Update service requests"
  on public.service_requests for update
  using (public.can_access_service_request(id))
  with check (public.can_access_service_request(id));

drop policy if exists "Read service visits" on public.service_visits;
create policy "Read service visits"
  on public.service_visits for select
  using (public.can_access_service_visit(id));

drop policy if exists "Insert service visits" on public.service_visits;
create policy "Insert service visits"
  on public.service_visits for insert
  with check (
    auth.uid() is not null
    and public.can_access_service_request(service_request_id)
  );

drop policy if exists "Update service visits" on public.service_visits;
create policy "Update service visits"
  on public.service_visits for update
  using (public.can_access_service_visit(id))
  with check (public.can_access_service_visit(id));

drop policy if exists "Read visit notes" on public.visit_notes;
create policy "Read visit notes"
  on public.visit_notes for select
  using (public.can_access_service_visit(service_visit_id));

drop policy if exists "Insert visit notes" on public.visit_notes;
create policy "Insert visit notes"
  on public.visit_notes for insert
  with check (
    public.can_access_service_visit(service_visit_id)
    and user_id = auth.uid()
  );

drop policy if exists "Read visit repairs" on public.visit_repairs;
create policy "Read visit repairs"
  on public.visit_repairs for select
  using (public.can_access_service_visit(service_visit_id));

drop policy if exists "Manage visit repairs" on public.visit_repairs;
create policy "Manage visit repairs"
  on public.visit_repairs for all
  using (public.can_access_service_visit(service_visit_id))
  with check (public.can_access_service_visit(service_visit_id));

drop policy if exists "Read visit parts needed" on public.visit_parts_needed;
create policy "Read visit parts needed"
  on public.visit_parts_needed for select
  using (public.can_access_service_visit(service_visit_id));

drop policy if exists "Manage visit parts needed" on public.visit_parts_needed;
create policy "Manage visit parts needed"
  on public.visit_parts_needed for all
  using (public.can_access_service_visit(service_visit_id))
  with check (public.can_access_service_visit(service_visit_id));

insert into public.service_requests (
  created_from_legacy_job_id,
  request_kind,
  billable,
  customer_id,
  location_id,
  unit_id,
  system_id,
  source,
  status,
  priority,
  problem_description,
  access_notes,
  manual_unit,
  requested_at,
  created_at
)
select
  j.id,
  'service_call',
  true,
  j.customer_id,
  j.location_id,
  j.unit_id,
  j.system_id,
  case coalesce(j.how_it_came_in, 'dispatcher')
    when 'web_form' then 'web_form'
    when 'tech_direct' then 'tech_direct'
    else 'dispatcher'
  end,
  case
    when j.job_status = 'cancelled' then 'cancelled'
    when j.commercial_state in ('parts_needed', 'parts_ordered', 'ready_to_schedule')
      or j.resolution_type = 'parts_sourcing' then 'waiting_parts'
    when j.job_status = 'completed' then 'completed'
    when j.job_status in ('dispatched', 'on_site', 'follow_up_active') then 'active'
    when j.job_status in ('scheduled', 'follow_up_planning', 'follow_up_scheduled') then 'scheduled'
    else 'intake'
  end,
  j.priority,
  j.problem_description,
  l.access_notes,
  j.manual_unit,
  j.created_at,
  j.created_at
from public.jobs j
join public.locations l on l.id = j.location_id
where not exists (
  select 1
  from public.service_requests sr
  where sr.created_from_legacy_job_id = j.id
);

insert into public.service_visits (
  service_request_id,
  legacy_job_id,
  visit_sequence,
  is_initial_visit,
  billable,
  assigned_tech,
  actual_tech,
  scheduled_date,
  queue_position,
  status,
  outcome,
  billing_status,
  access_confirmed,
  access_confirmation_needed,
  needs_return_visit,
  no_invoice_until_return_complete,
  arrival_notes,
  departed_at,
  arrived_at,
  completed_at,
  created_at
)
select
  sr.id,
  j.id,
  1,
  true,
  true,
  j.assigned_tech,
  j.actual_tech,
  j.job_date,
  j.queue_position,
  case
    when j.job_status = 'cancelled' then 'cancelled'
    when j.job_status = 'completed' then 'completed'
    when j.job_status in ('on_site', 'follow_up_active') then 'on_site'
    when j.job_status = 'dispatched' then 'en_route'
    else 'scheduled'
  end,
  case
    when j.commercial_state in ('parts_needed', 'parts_ordered', 'ready_to_schedule')
      or j.resolution_type = 'parts_sourcing' then 'parts_needed'
    when j.resolution_type = 'closed_no_action' then 'closed_no_action'
    when j.resolution_type = 'monitor_only' then 'monitor_only'
    when j.diagnosis_id is not null
      or exists (
        select 1
        from public.job_adhoc_bundles jab
        where jab.job_id = j.id
      ) then 'repair_completed'
    else null
  end,
  case
    when j.commercial_state = 'invoiced' then 'invoiced'
    when j.commercial_state in ('parts_needed', 'parts_ordered', 'ready_to_schedule')
      or j.resolution_type = 'parts_sourcing' then 'blocked_parts_return'
    when j.job_status = 'completed' and j.resolution_type = 'closed_no_action' then 'not_billable'
    when j.job_status = 'completed' then 'ready_for_invoice'
    else 'not_ready'
  end,
  j.access_confirmed,
  j.access_confirmation_needed,
  (
    coalesce(j.commercial_state in ('parts_needed', 'parts_ordered', 'ready_to_schedule'), false)
    or coalesce(j.resolution_type = 'parts_sourcing', false)
  ),
  (
    coalesce(j.commercial_state in ('parts_needed', 'parts_ordered', 'ready_to_schedule'), false)
    or coalesce(j.resolution_type = 'parts_sourcing', false)
  ),
  j.arrival_notes,
  j.departed_at,
  j.arrived_at,
  j.completed_at,
  j.created_at
from public.jobs j
join public.service_requests sr on sr.created_from_legacy_job_id = j.id
where not exists (
  select 1
  from public.service_visits sv
  where sv.legacy_job_id = j.id
);

update public.job_invoice_snapshots jis
set
  service_request_id = sr.id,
  service_visit_id = sv.id
from public.service_requests sr
join public.service_visits sv on sv.service_request_id = sr.id
where jis.job_id = sr.created_from_legacy_job_id
  and jis.service_request_id is null
  and jis.service_visit_id is null;
