-- ============================================================
-- Migration 013: CRUD RLS for jobs
-- Align job insert/update permissions with the authenticated-user
-- CRUD model already applied to customers/locations/units/systems.
-- This allows planning-board assignment and reassignment actions
-- to succeed for authenticated app users.
-- ============================================================

drop policy if exists "Admins write jobs" on public.jobs;
drop policy if exists "Techs update own jobs" on public.jobs;

create policy "Authenticated insert jobs"
  on public.jobs for insert
  with check (auth.uid() is not null);

create policy "Authenticated update jobs"
  on public.jobs for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
