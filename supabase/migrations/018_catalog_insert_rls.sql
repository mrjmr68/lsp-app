-- ============================================================
-- Migration 018: Catalog insert RLS fixes
-- The original "Admins write ..." catalog policies use `for all`
-- with `using (...)`, which does not authorize INSERT rows.
-- Add explicit INSERT policies with `with check (...)` so the
-- catalog importer can seed items, diagnoses, bundles, and lines.
-- ============================================================

create policy "Admins insert diagnoses"
  on public.diagnoses for insert
  with check (is_admin());

create policy "Admins insert items"
  on public.items for insert
  with check (is_admin());

create policy "Admins insert bundles"
  on public.repair_bundles for insert
  with check (is_admin());

create policy "Admins insert bundle_lines"
  on public.repair_bundle_lines for insert
  with check (is_admin());
