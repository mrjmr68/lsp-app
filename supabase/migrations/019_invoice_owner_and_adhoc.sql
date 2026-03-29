-- ============================================================
-- Migration 019: Invoice role support + ad-hoc bundle policies
-- ============================================================

alter table public.jobs
  add column if not exists flagged_for_review boolean not null default false,
  add column if not exists flat_rate_override numeric(8,2),
  add column if not exists invoice_number text;

alter table public.job_adhoc_bundle_lines
  add column if not exists cost_at_build numeric(8,2) not null default 0;

create unique index if not exists jobs_invoice_number_unique
  on public.jobs (invoice_number)
  where invoice_number is not null;

create or replace function public.is_owner()
returns boolean as $$
  select current_user_role() = 'owner';
$$ language sql security definer stable;

create or replace function public.enforce_owner_invoice_job_updates()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_role() <> 'owner' and (
    new.flagged_for_review is distinct from old.flagged_for_review
    or new.flat_rate_override is distinct from old.flat_rate_override
    or new.invoice_number is distinct from old.invoice_number
    or new.invoice_subtotal is distinct from old.invoice_subtotal
    or new.invoice_tax is distinct from old.invoice_tax
    or new.invoice_total is distinct from old.invoice_total
    or new.invoice_amount is distinct from old.invoice_amount
    or new.invoice_pdf_path is distinct from old.invoice_pdf_path
    or new.tax_rate is distinct from old.tax_rate
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or (new.needs_admin_review is distinct from old.needs_admin_review and new.needs_admin_review = false)
    or (new.status is distinct from old.status and new.status = 'invoiced')
  ) then
    raise exception 'Invoice fields can only be updated by the owner.';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_owner_invoice_guard on public.jobs;

create trigger jobs_owner_invoice_guard
  before update on public.jobs
  for each row execute procedure public.enforce_owner_invoice_job_updates();

drop policy if exists "Techs and admins write adhoc bundles" on public.job_adhoc_bundles;

create policy "Techs and admins write adhoc bundles"
  on public.job_adhoc_bundles for all
  using (
    is_admin()
    or exists (
      select 1 from public.jobs
      where public.jobs.id = job_adhoc_bundles.job_id
        and (
          public.jobs.assigned_tech = auth.uid()
          or public.jobs.actual_tech = auth.uid()
        )
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from public.jobs
      where public.jobs.id = job_adhoc_bundles.job_id
        and (
          public.jobs.assigned_tech = auth.uid()
          or public.jobs.actual_tech = auth.uid()
        )
    )
  );

create policy "Read adhoc bundle lines for own jobs"
  on public.job_adhoc_bundle_lines for select
  using (
    is_admin()
    or exists (
      select 1
      from public.job_adhoc_bundles
      join public.jobs
        on public.jobs.id = public.job_adhoc_bundles.job_id
      where public.job_adhoc_bundles.id = job_adhoc_bundle_lines.adhoc_bundle_id
        and (
          public.jobs.assigned_tech = auth.uid()
          or public.jobs.actual_tech = auth.uid()
        )
    )
  );

create policy "Techs and admins write adhoc bundle lines"
  on public.job_adhoc_bundle_lines for all
  using (
    is_admin()
    or exists (
      select 1
      from public.job_adhoc_bundles
      join public.jobs
        on public.jobs.id = public.job_adhoc_bundles.job_id
      where public.job_adhoc_bundles.id = job_adhoc_bundle_lines.adhoc_bundle_id
        and (
          public.jobs.assigned_tech = auth.uid()
          or public.jobs.actual_tech = auth.uid()
        )
    )
  )
  with check (
    is_admin()
    or exists (
      select 1
      from public.job_adhoc_bundles
      join public.jobs
        on public.jobs.id = public.job_adhoc_bundles.job_id
      where public.job_adhoc_bundles.id = job_adhoc_bundle_lines.adhoc_bundle_id
        and (
          public.jobs.assigned_tech = auth.uid()
          or public.jobs.actual_tech = auth.uid()
        )
    )
  );
