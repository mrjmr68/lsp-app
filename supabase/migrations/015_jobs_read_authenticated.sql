-- ============================================================
-- Migration 015: Authenticated read access for jobs
-- Planning needs to show all jobs across tech lanes, even when a
-- tech user reassigns a job away from themselves.
-- ============================================================

drop policy if exists "Techs read own jobs" on public.jobs;

create policy "Authenticated read jobs"
  on public.jobs for select
  using (auth.uid() is not null);
