-- ============================================================
-- Migration 008: Fix RLS infinite recursion on jobs/users
--
-- The RLS policy on users calls is_admin(), which calls
-- current_user_role(), which SELECTs from users — triggering
-- the users policy again. Classic recursion loop.
--
-- Fix: recreate current_user_role() with SET search_path
-- and ensure it runs as the function owner (security definer)
-- so it bypasses RLS when reading the users table.
-- ============================================================

-- Recreate the helper with explicit search_path to silence
-- the Supabase security warning and ensure RLS bypass works
create or replace function public.current_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select public.current_user_role() in ('admin','owner','dispatcher');
$$ language sql security definer stable set search_path = public;

-- Drop the recursive users policy and replace with a non-recursive version.
-- The original called is_admin() which queries users — causing the loop.
-- New version checks auth.uid() directly for own-record access, and uses
-- current_user_role() (which bypasses RLS via security definer) for admin check.
drop policy if exists "Users can read own profile" on public.users;
drop policy if exists "Admins manage users" on public.users;

create policy "Users can read own profile"
  on public.users for select
  using (
    id = auth.uid()
    or public.current_user_role() in ('admin','owner','dispatcher')
  );

create policy "Admins manage users"
  on public.users for all
  using (public.current_user_role() in ('admin','owner','dispatcher'));
