-- ============================================================
-- Migration 024: Repair estimate lifecycle support
-- Estimate drafts, PDF storage, and owner/admin review access.
-- ============================================================

create or replace function public.is_owner_or_admin()
returns boolean as $$
  select public.current_user_role() in ('owner', 'admin');
$$ language sql security definer stable;

create table if not exists public.job_estimates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  estimate_number text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'declined')),
  customer_summary text,
  scope_of_work text,
  line_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(line_items) = 'array'),
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  send_to_email text,
  cc_email text,
  pdf_path text,
  generated_at timestamptz,
  generated_by uuid references public.users(id),
  sent_at timestamptz,
  sent_by uuid references public.users(id),
  approved_at timestamptz,
  approved_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_estimates_number_unique
  on public.job_estimates (estimate_number)
  where estimate_number is not null;

create index if not exists job_estimates_status_idx
  on public.job_estimates (status);

create or replace function public.touch_job_estimate_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_estimates_touch_updated_at on public.job_estimates;

create trigger job_estimates_touch_updated_at
  before update on public.job_estimates
  for each row execute procedure public.touch_job_estimate_updated_at();

alter table public.job_estimates enable row level security;

drop policy if exists "Owner and admin read estimates" on public.job_estimates;
create policy "Owner and admin read estimates"
  on public.job_estimates for select
  using (public.is_owner_or_admin());

drop policy if exists "Owner and admin manage estimates" on public.job_estimates;
create policy "Owner and admin manage estimates"
  on public.job_estimates for all
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estimate-pdfs',
  'estimate-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owner and admin read estimate pdfs" on storage.objects;
create policy "Owner and admin read estimate pdfs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'estimate-pdfs'
  and public.is_owner_or_admin()
);

drop policy if exists "Owner and admin upload estimate pdfs" on storage.objects;
create policy "Owner and admin upload estimate pdfs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'estimate-pdfs'
  and public.is_owner_or_admin()
);

drop policy if exists "Owner and admin update estimate pdfs" on storage.objects;
create policy "Owner and admin update estimate pdfs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'estimate-pdfs'
  and public.is_owner_or_admin()
)
with check (
  bucket_id = 'estimate-pdfs'
  and public.is_owner_or_admin()
);

drop policy if exists "Owner and admin delete estimate pdfs" on storage.objects;
create policy "Owner and admin delete estimate pdfs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'estimate-pdfs'
  and public.is_owner_or_admin()
);

create or replace function public.enforce_owner_invoice_job_updates()
returns trigger
language plpgsql
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_role := public.current_user_role();

  if v_role not in ('owner', 'admin') and (
    new.flagged_for_review is distinct from old.flagged_for_review
    or new.flat_rate_override is distinct from old.flat_rate_override
    or new.admin_notes is distinct from old.admin_notes
    or (new.needs_admin_review is distinct from old.needs_admin_review and new.needs_admin_review = false)
  ) then
    raise exception 'Estimate and invoice review fields can only be updated by the owner or admin.';
  end if;

  if v_role <> 'owner' and (
    new.invoice_number is distinct from old.invoice_number
    or new.invoice_subtotal is distinct from old.invoice_subtotal
    or new.invoice_tax is distinct from old.invoice_tax
    or new.invoice_total is distinct from old.invoice_total
    or new.invoice_amount is distinct from old.invoice_amount
    or new.invoice_pdf_path is distinct from old.invoice_pdf_path
    or new.tax_rate is distinct from old.tax_rate
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or (new.status is distinct from old.status and new.status = 'invoiced')
    or (new.commercial_state is distinct from old.commercial_state and new.commercial_state = 'invoiced')
  ) then
    raise exception 'Invoice finalization fields can only be updated by the owner.';
  end if;

  return new;
end;
$$;
