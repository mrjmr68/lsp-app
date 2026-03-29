-- ============================================================
-- Migration 004: Row Level Security
-- Techs see only their own jobs.
-- Dispatchers, admins, owners see everything.
-- ============================================================

-- Helper: get current user's role
create or replace function public.current_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

-- Helper: is current user admin or above?
create or replace function public.is_admin()
returns boolean as $$
  select current_user_role() in ('admin','owner','dispatcher');
$$ language sql security definer stable;

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.app_config enable row level security;
alter table public.refrigerant_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.locations enable row level security;
alter table public.units enable row level security;
alter table public.systems enable row level security;
alter table public.persons enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.diagnoses enable row level security;
alter table public.items enable row level security;
alter table public.repair_bundles enable row level security;
alter table public.repair_bundle_lines enable row level security;
alter table public.jobs enable row level security;
alter table public.job_tech enable row level security;
alter table public.job_events enable row level security;
alter table public.job_addons enable row level security;
alter table public.job_adhoc_bundles enable row level security;
alter table public.job_adhoc_bundle_lines enable row level security;
alter table public.job_placeholder_costs enable row level security;

-- ---- USERS ----
create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid() or is_admin());

create policy "Admins manage users"
  on public.users for all
  using (is_admin());

-- ---- APP CONFIG ----
create policy "Anyone can read app_config"
  on public.app_config for select using (true);

create policy "Admins update app_config"
  on public.app_config for update using (is_admin());

-- ---- REFRIGERANT PROFILES ----
create policy "Anyone can read refrigerant_profiles"
  on public.refrigerant_profiles for select using (true);

create policy "Admins manage refrigerant_profiles"
  on public.refrigerant_profiles for all using (is_admin());

-- ---- CUSTOMERS / LOCATIONS / UNITS / SYSTEMS ----
create policy "All read customers"
  on public.customers for select using (true);
create policy "Admins write customers"
  on public.customers for all using (is_admin());

create policy "All read locations"
  on public.locations for select using (true);
create policy "Admins write locations"
  on public.locations for all using (is_admin());

create policy "All read units"
  on public.units for select using (true);
create policy "Admins write units"
  on public.units for all using (is_admin());

create policy "All read systems"
  on public.systems for select using (true);
create policy "Admins write systems"
  on public.systems for all using (is_admin());

-- ---- CATALOG ----
create policy "All read diagnoses"
  on public.diagnoses for select using (true);
create policy "Admins write diagnoses"
  on public.diagnoses for all using (is_admin());

create policy "All read items"
  on public.items for select using (true);
create policy "Admins write items"
  on public.items for all using (is_admin());

create policy "All read bundles"
  on public.repair_bundles for select using (true);
create policy "Admins write bundles"
  on public.repair_bundles for all using (is_admin());

create policy "All read bundle_lines"
  on public.repair_bundle_lines for select using (true);
create policy "Admins write bundle_lines"
  on public.repair_bundle_lines for all using (is_admin());

-- ---- JOBS ----
create policy "Techs read own jobs"
  on public.jobs for select
  using (
    is_admin()
    or assigned_tech = auth.uid()
    or actual_tech = auth.uid()
    or exists (
      select 1 from public.job_tech
      where job_id = jobs.id and user_id = auth.uid()
    )
  );

create policy "Admins write jobs"
  on public.jobs for all using (is_admin());

create policy "Techs update own jobs"
  on public.jobs for update
  using (
    assigned_tech = auth.uid()
    or exists (
      select 1 from public.job_tech
      where job_id = jobs.id and user_id = auth.uid()
    )
  );

-- ---- JOB TECH ----
create policy "Techs read job_tech for their jobs"
  on public.job_tech for select
  using (
    is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.jobs
      where id = job_tech.job_id and assigned_tech = auth.uid()
    )
  );

create policy "Techs insert job_tech (add helper)"
  on public.job_tech for insert
  with check (
    is_admin()
    or exists (
      select 1 from public.jobs
      where id = job_tech.job_id and assigned_tech = auth.uid()
    )
  );

-- ---- JOB EVENTS ----
create policy "Read job events for own jobs"
  on public.job_events for select
  using (
    is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.job_tech
      where job_id = job_events.job_id and user_id = auth.uid()
    )
  );

create policy "Techs insert own events"
  on public.job_events for insert
  with check (user_id = auth.uid() or is_admin());

-- ---- JOB ADDONS ----
create policy "Read addons for own jobs"
  on public.job_addons for select
  using (
    is_admin()
    or exists (
      select 1 from public.job_tech
      where job_id = job_addons.job_id and user_id = auth.uid()
    )
  );

create policy "Techs insert addons"
  on public.job_addons for insert
  with check (added_by = auth.uid() or is_admin());

-- ---- AD-HOC BUNDLES ----
create policy "Read adhoc bundles for own jobs"
  on public.job_adhoc_bundles for select
  using (
    is_admin()
    or exists (
      select 1 from public.job_tech
      where job_id = job_adhoc_bundles.job_id and user_id = auth.uid()
    )
  );

create policy "Techs and admins write adhoc bundles"
  on public.job_adhoc_bundles for all
  using (is_admin())
  with check (true);

-- ---- PLACEHOLDER COSTS (admin only) ----
create policy "Admins manage placeholder costs"
  on public.job_placeholder_costs for all using (is_admin());
