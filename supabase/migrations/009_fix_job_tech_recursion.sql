-- ============================================================
-- Migration 009: Fix RLS recursion between jobs ↔ job_tech
--
-- The jobs SELECT policy includes:
--   exists (select 1 from job_tech where job_id = jobs.id ...)
-- And the job_tech SELECT policy includes:
--   exists (select 1 from jobs where id = job_tech.job_id ...)
-- This creates infinite recursion when Postgres evaluates
-- both policies at once.
--
-- Fix: Create a security definer function that bypasses RLS
-- to check job assignment, and use it in the job_tech policy
-- instead of a direct subquery to jobs.
-- ============================================================

-- Helper: check if current user is assigned to a job (bypasses RLS)
create or replace function public.is_assigned_to_job(p_job_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id
      and (assigned_tech = auth.uid() or actual_tech = auth.uid())
  );
$$ language sql security definer stable set search_path = public;

-- Drop and recreate job_tech SELECT policy without subquery to jobs
drop policy if exists "Techs read job_tech for their jobs" on public.job_tech;

create policy "Techs read job_tech for their jobs"
  on public.job_tech for select
  using (
    is_admin()
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
  );

-- Also fix job_tech INSERT policy (same pattern)
drop policy if exists "Techs insert job_tech (add helper)" on public.job_tech;

create policy "Techs insert job_tech (add helper)"
  on public.job_tech for insert
  with check (
    is_admin()
    or public.is_assigned_to_job(job_id)
  );
