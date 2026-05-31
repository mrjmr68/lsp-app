-- ============================================================
-- Migration 027: Repair template pricing detail + invoice snapshots
-- Preserve spreadsheet pricing context in repair bundles and
-- persist finalized invoice snapshots so historical invoices do
-- not drift when catalog templates change later.
-- ============================================================

alter table public.repair_bundles
  add column if not exists travel_time_hours numeric(6,2),
  add column if not exists work_time_hours numeric(6,2),
  add column if not exists total_time_hours numeric(6,2),
  add column if not exists labor_cost numeric(10,2),
  add column if not exists part_material_cost numeric(10,2),
  add column if not exists profit_amount numeric(10,2),
  add column if not exists profit_per_hour numeric(10,2),
  add column if not exists margin_percent numeric(6,4),
  add column if not exists refrigerant_lbs numeric(8,2),
  add column if not exists refrigerant_cost numeric(10,2),
  add column if not exists materials_label text,
  add column if not exists material_cost numeric(10,2),
  add column if not exists pricing_notes text;

create table if not exists public.job_invoice_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  invoice_number text,
  invoice_date timestamptz not null default now(),
  source text not null default 'diagnosis_bundle'
    check (source in ('estimate', 'diagnosis_bundle', 'adhoc_bundle')),
  send_to_email text,
  cc_email text,
  bill_to_name text not null,
  bill_to_email text,
  customer_name text not null,
  location_name text not null,
  unit_label text,
  tech_name text,
  service_date date,
  reference_line text,
  description_title text not null,
  description_body text,
  primary_label text not null,
  line_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(line_items) = 'array'),
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_job_invoice_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_invoice_snapshots_touch_updated_at on public.job_invoice_snapshots;

create trigger job_invoice_snapshots_touch_updated_at
  before update on public.job_invoice_snapshots
  for each row execute procedure public.touch_job_invoice_snapshot_updated_at();

alter table public.job_invoice_snapshots enable row level security;

drop policy if exists "Owner and admin read invoice snapshots" on public.job_invoice_snapshots;
create policy "Owner and admin read invoice snapshots"
  on public.job_invoice_snapshots for select
  using (public.is_owner_or_admin());

drop policy if exists "Owner and admin manage invoice snapshots" on public.job_invoice_snapshots;
create policy "Owner and admin manage invoice snapshots"
  on public.job_invoice_snapshots for all
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());
