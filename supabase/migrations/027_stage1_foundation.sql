-- 027_stage1_foundation.sql
-- v1 Stage 1 foundation (LSP App v1 Build Brief, "Data changes").
-- Additive only: no columns dropped, no existing data rewritten.

-- 1. NC county sales tax rates ------------------------------------------
-- Source: NC Department of Revenue, current sales and use tax rates,
-- effective 2026-07-01 (read 2026-11-18). Every invoice line is taxable.
create table if not exists public.nc_county_tax_rates (
  id uuid primary key default gen_random_uuid(),
  county text not null unique,
  rate numeric(5,4) not null check (rate >= 0 and rate < 0.2),
  effective_date date not null,
  updated_at timestamptz not null default now()
);

insert into public.nc_county_tax_rates (county, rate, effective_date) values
  ('Alamance', 0.0675, date '2026-07-01'),
  ('Alexander', 0.0700, date '2026-07-01'),
  ('Alleghany', 0.0700, date '2026-07-01'),
  ('Anson', 0.0700, date '2026-07-01'),
  ('Ashe', 0.0700, date '2026-07-01'),
  ('Avery', 0.0675, date '2026-07-01'),
  ('Beaufort', 0.0675, date '2026-07-01'),
  ('Bertie', 0.0700, date '2026-07-01'),
  ('Bladen', 0.0675, date '2026-07-01'),
  ('Brunswick', 0.0675, date '2026-07-01'),
  ('Buncombe', 0.0700, date '2026-07-01'),
  ('Burke', 0.0675, date '2026-07-01'),
  ('Cabarrus', 0.0700, date '2026-07-01'),
  ('Caldwell', 0.0675, date '2026-07-01'),
  ('Camden', 0.0675, date '2026-07-01'),
  ('Carteret', 0.0675, date '2026-07-01'),
  ('Caswell', 0.0675, date '2026-07-01'),
  ('Catawba', 0.0700, date '2026-07-01'),
  ('Chatham', 0.0700, date '2026-07-01'),
  ('Cherokee', 0.0700, date '2026-07-01'),
  ('Chowan', 0.0675, date '2026-07-01'),
  ('Clay', 0.0700, date '2026-07-01'),
  ('Cleveland', 0.0675, date '2026-07-01'),
  ('Columbus', 0.0675, date '2026-07-01'),
  ('Craven', 0.0675, date '2026-07-01'),
  ('Cumberland', 0.0700, date '2026-07-01'),
  ('Currituck', 0.0675, date '2026-07-01'),
  ('Dare', 0.0675, date '2026-07-01'),
  ('Davidson', 0.0700, date '2026-07-01'),
  ('Davie', 0.0675, date '2026-07-01'),
  ('Duplin', 0.0700, date '2026-07-01'),
  ('Durham', 0.0750, date '2026-07-01'),
  ('Edgecombe', 0.0700, date '2026-07-01'),
  ('Forsyth', 0.0700, date '2026-07-01'),
  ('Franklin', 0.0675, date '2026-07-01'),
  ('Gaston', 0.0700, date '2026-07-01'),
  ('Gates', 0.0675, date '2026-07-01'),
  ('Graham', 0.0700, date '2026-07-01'),
  ('Granville', 0.0675, date '2026-07-01'),
  ('Greene', 0.0700, date '2026-07-01'),
  ('Guilford', 0.0675, date '2026-07-01'),
  ('Halifax', 0.0700, date '2026-07-01'),
  ('Harnett', 0.0700, date '2026-07-01'),
  ('Haywood', 0.0700, date '2026-07-01'),
  ('Henderson', 0.0675, date '2026-07-01'),
  ('Hertford', 0.0700, date '2026-07-01'),
  ('Hoke', 0.0675, date '2026-07-01'),
  ('Hyde', 0.0675, date '2026-07-01'),
  ('Iredell', 0.0675, date '2026-07-01'),
  ('Jackson', 0.0700, date '2026-07-01'),
  ('Johnston', 0.0675, date '2026-07-01'),
  ('Jones', 0.0700, date '2026-07-01'),
  ('Lee', 0.0700, date '2026-07-01'),
  ('Lenoir', 0.0675, date '2026-07-01'),
  ('Lincoln', 0.0700, date '2026-07-01'),
  ('Macon', 0.0675, date '2026-07-01'),
  ('Madison', 0.0700, date '2026-07-01'),
  ('Martin', 0.0700, date '2026-07-01'),
  ('McDowell', 0.0675, date '2026-07-01'),
  ('Mecklenburg', 0.0825, date '2026-07-01'),
  ('Mitchell', 0.0675, date '2026-07-01'),
  ('Montgomery', 0.0700, date '2026-07-01'),
  ('Moore', 0.0700, date '2026-07-01'),
  ('Nash', 0.0675, date '2026-07-01'),
  ('New Hanover', 0.0700, date '2026-07-01'),
  ('Northampton', 0.0675, date '2026-07-01'),
  ('Onslow', 0.0700, date '2026-07-01'),
  ('Orange', 0.0750, date '2026-07-01'),
  ('Pamlico', 0.0675, date '2026-07-01'),
  ('Pasquotank', 0.0700, date '2026-07-01'),
  ('Pender', 0.0675, date '2026-07-01'),
  ('Perquimans', 0.0675, date '2026-07-01'),
  ('Person', 0.0675, date '2026-07-01'),
  ('Pitt', 0.0700, date '2026-07-01'),
  ('Polk', 0.0675, date '2026-07-01'),
  ('Randolph', 0.0700, date '2026-07-01'),
  ('Richmond', 0.0675, date '2026-07-01'),
  ('Robeson', 0.0700, date '2026-07-01'),
  ('Rockingham', 0.0700, date '2026-07-01'),
  ('Rowan', 0.0700, date '2026-07-01'),
  ('Rutherford', 0.0700, date '2026-07-01'),
  ('Sampson', 0.0700, date '2026-07-01'),
  ('Scotland', 0.0675, date '2026-07-01'),
  ('Stanly', 0.0700, date '2026-07-01'),
  ('Stokes', 0.0675, date '2026-07-01'),
  ('Surry', 0.0700, date '2026-07-01'),
  ('Swain', 0.0700, date '2026-07-01'),
  ('Transylvania', 0.0675, date '2026-07-01'),
  ('Tyrrell', 0.0675, date '2026-07-01'),
  ('Union', 0.0675, date '2026-07-01'),
  ('Vance', 0.0675, date '2026-07-01'),
  ('Wake', 0.0725, date '2026-07-01'),
  ('Warren', 0.0675, date '2026-07-01'),
  ('Washington', 0.0700, date '2026-07-01'),
  ('Watauga', 0.0675, date '2026-07-01'),
  ('Wayne', 0.0675, date '2026-07-01'),
  ('Wilkes', 0.0700, date '2026-07-01'),
  ('Wilson', 0.0675, date '2026-07-01'),
  ('Yadkin', 0.0675, date '2026-07-01'),
  ('Yancey', 0.0675, date '2026-07-01')
on conflict (county) do nothing;

alter table public.nc_county_tax_rates enable row level security;
drop policy if exists "Authenticated read county tax" on public.nc_county_tax_rates;
create policy "Authenticated read county tax" on public.nc_county_tax_rates
  for select to authenticated using (true);
drop policy if exists "Admins update county tax" on public.nc_county_tax_rates;
create policy "Admins update county tax" on public.nc_county_tax_rates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Locations: county link, property rules, retire ----------------------
-- locations.tax_rate (migration 006) stays as an optional override;
-- when null, the rate comes from the linked county.
alter table public.locations
  add column if not exists county_id uuid references public.nc_county_tax_rates(id),
  add column if not exists add_on_rule text,
  add column if not exists sign_off_rule text,
  add column if not exists resident_report_rule text,
  add column if not exists active boolean not null default true;

-- 3. Retire flags on the remaining owner-managed records -----------------
alter table public.customers      add column if not exists active boolean not null default true;
alter table public.units          add column if not exists active boolean not null default true;
alter table public.persons        add column if not exists active boolean not null default true;
alter table public.repair_bundles add column if not exists active boolean not null default true;
alter table public.items          add column if not exists active boolean not null default true;
-- users.active already exists (migration 001).

-- 4. Suppliers ----------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
drop policy if exists "Authenticated read suppliers" on public.suppliers;
create policy "Authenticated read suppliers" on public.suppliers
  for select to authenticated using (true);
drop policy if exists "Admins insert suppliers" on public.suppliers;
create policy "Admins insert suppliers" on public.suppliers
  for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update suppliers" on public.suppliers;
create policy "Admins update suppliers" on public.suppliers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.job_parts_requests
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists order_number text;

-- 5. Tech's own job order (My Jobs reorder) -----------------------------
alter table public.job_tech
  add column if not exists my_jobs_position integer;

-- 6. Visit timestamps: work started (Job Start tap) ---------------------
-- departed_at / arrived_at / completed_at already exist on jobs.
alter table public.jobs
  add column if not exists work_started_at timestamptz;

do $$
begin
  alter table public.job_events drop constraint if exists job_events_event_type_check;
  alter table public.job_events add constraint job_events_event_type_check check (
    event_type in ('claimed','departed','arrived','work_started','completed',
                   'reassigned','helper_added','cancelled')
  );
end $$;

-- 7. Tech location (crew strip, closest-first, GPS arrival) -------------
create table if not exists public.tech_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id),
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  recorded_at timestamptz not null default now()
);
create index if not exists tech_locations_user_time_idx
  on public.tech_locations (user_id, recorded_at desc);

alter table public.tech_locations enable row level security;
drop policy if exists "Techs insert own location" on public.tech_locations;
create policy "Techs insert own location" on public.tech_locations
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Own or admin read location" on public.tech_locations;
create policy "Own or admin read location" on public.tech_locations
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace view public.tech_latest_location
with (security_invoker = true) as
  select distinct on (user_id) user_id, lat, lng, recorded_at
  from public.tech_locations
  order by user_id, recorded_at desc;

-- 8. Portal role groundwork (screens and portal RLS come in Stage 5) ----
alter table public.users
  add column if not exists customer_id uuid references public.customers(id);

do $$
begin
  alter table public.users drop constraint if exists users_role_check;
  alter table public.users add constraint users_role_check
    check (role in ('tech','dispatcher','admin','owner','portal'));
end $$;
