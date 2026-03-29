-- ============================================================
-- Migration 003: Jobs
-- jobs, job_tech, job_events, job_addons,
-- job_adhoc_bundles, job_adhoc_bundle_lines,
-- job_placeholder_costs
-- ============================================================

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  location_id uuid not null references public.locations(id),
  unit_id uuid references public.units(id),
  system_id uuid references public.systems(id),
  diagnosis_id uuid references public.diagnoses(id),

  -- Tech assignment (convenience denorms of job_tech — always keep in sync)
  assigned_tech uuid references public.users(id),
  actual_tech uuid references public.users(id),

  how_it_came_in text check (how_it_came_in in ('web_form','dispatcher','tech_direct')),
  submitter_email text,
  manual_unit text,

  status text not null default 'new' check (
    status in ('new','assigned','en_route','in_progress','completed',
               'closed_no_diagnosis','cancelled','invoiced')
  ),
  priority text not null default 'routine' check (
    priority in ('routine','urgent','emergency')
  ),

  job_date date not null,
  queue_position integer,

  access_confirmation_needed boolean not null default false,
  access_confirmed boolean not null default false,
  new_diagnosis_requested boolean not null default false,
  needs_admin_review boolean not null default false,

  problem_description text,

  -- Timestamps
  created_at timestamptz not null default now(),
  first_visit_at timestamptz,
  second_visit_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,

  -- Field observations
  tstat_mode text check (tstat_mode in ('cool','heat','em_heat','fan_only','off')),
  tstat_fan text check (tstat_fan in ('auto','on')),
  system_response text check (
    system_response in ('running_normal','not_running','short_cycling','fault_lockout','fan_only')
  ),
  temp_outdoor numeric(5,1),
  temp_outdoor_auto numeric(5,1),
  temp_return numeric(5,1),
  temp_supply numeric(5,1),
  arrival_notes text,

  -- Invoice
  invoice_amount numeric(8,2),
  admin_notes text,
  invoice_pdf_path text,
  approved_at timestamptz,
  approved_by uuid references public.users(id)
);

-- All techs on a job (primary + assists)
create table public.job_tech (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  user_id uuid not null references public.users(id),
  role text not null check (role in ('primary','assist')),
  assigned_at timestamptz not null default now(),
  unique (job_id, user_id)
);

-- Append-only status event log
create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  user_id uuid not null references public.users(id),
  event_type text not null check (
    event_type in ('claimed','departed','arrived','completed',
                   'reassigned','helper_added','cancelled')
  ),
  occurred_at timestamptz not null default now(),
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  note text
);

-- Additional work beyond the primary bundle
create table public.job_addons (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  type text not null check (type in ('bundle','item')),
  bundle_id uuid references public.repair_bundles(id),
  item_id uuid references public.items(id),
  quantity numeric(8,2) not null default 1,
  added_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- Ad-hoc bundle (no matching diagnosis in catalog)
create table public.job_adhoc_bundles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  tech_description text not null,
  reviewed_by_admin boolean not null default false,
  admin_action text check (admin_action in ('one_off','promoted')),
  promoted_diagnosis_id uuid references public.diagnoses(id),
  created_at timestamptz not null default now()
);

create table public.job_adhoc_bundle_lines (
  id uuid primary key default gen_random_uuid(),
  adhoc_bundle_id uuid not null references public.job_adhoc_bundles(id),
  item_id uuid not null references public.items(id),
  quantity numeric(8,2) not null default 1,
  added_by uuid not null references public.users(id)
);

-- Actual costs for placeholder ($0) items — entered by admin at review
create table public.job_placeholder_costs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  item_id uuid not null references public.items(id),
  actual_cost numeric(8,2) not null,
  entered_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
