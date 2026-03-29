-- ============================================================
-- Migration 017: Job observation circuits
-- Store per-circuit refrigeration readings for the Observe and
-- Diagnose workflow while shared air temperatures remain on jobs.
-- ============================================================

create table public.job_observation_circuits (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  circuit_number integer not null check (circuit_number in (1, 2)),
  suction_pressure numeric(6,1),
  suction_line_temp numeric(5,1),
  liquid_pressure numeric(6,1),
  liquid_line_temp numeric(5,1),
  created_at timestamptz not null default now(),
  unique (job_id, circuit_number)
);

alter table public.job_observation_circuits enable row level security;

create policy "Authenticated read job observation circuits"
  on public.job_observation_circuits for select
  using (auth.uid() is not null);

create policy "Authenticated insert job observation circuits"
  on public.job_observation_circuits for insert
  with check (auth.uid() is not null);

create policy "Authenticated update job observation circuits"
  on public.job_observation_circuits for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated delete job observation circuits"
  on public.job_observation_circuits for delete
  using (auth.uid() is not null);
