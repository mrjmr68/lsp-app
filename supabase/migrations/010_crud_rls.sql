-- ============================================================
-- Migration 010: CRUD RLS for customers/locations/units/systems
-- Allow all authenticated users to insert and update records.
-- The existing "Admins write X" for-all policies may not have
-- proper WITH CHECK for inserts. This adds explicit insert/update
-- policies for all authenticated users.
-- ============================================================

-- Drop the old "Admins write" for-all policies (they overlap with these)
drop policy if exists "Admins write customers" on public.customers;
drop policy if exists "Admins write locations" on public.locations;
drop policy if exists "Admins write units" on public.units;
drop policy if exists "Admins write systems" on public.systems;

-- Customers: all authenticated users can insert and update
create policy "Authenticated insert customers"
  on public.customers for insert
  with check (auth.uid() is not null);

create policy "Authenticated update customers"
  on public.customers for update
  using (auth.uid() is not null);

-- Locations: all authenticated users can insert and update
create policy "Authenticated insert locations"
  on public.locations for insert
  with check (auth.uid() is not null);

create policy "Authenticated update locations"
  on public.locations for update
  using (auth.uid() is not null);

-- Units: all authenticated users can insert and update
create policy "Authenticated insert units"
  on public.units for insert
  with check (auth.uid() is not null);

create policy "Authenticated update units"
  on public.units for update
  using (auth.uid() is not null);

-- Systems: all authenticated users can insert and update
create policy "Authenticated insert systems"
  on public.systems for insert
  with check (auth.uid() is not null);

create policy "Authenticated update systems"
  on public.systems for update
  using (auth.uid() is not null);
