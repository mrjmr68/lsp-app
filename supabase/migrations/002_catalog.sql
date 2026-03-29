-- ============================================================
-- Migration 002: Catalog
-- diagnoses, repair_bundles, repair_bundle_lines, items
-- ============================================================

-- Diagnoses (taxonomy-driven, sourced from Operations - Invoicing - V2.csv)
create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  location text not null,        -- AHU, CU, SYS, FU, REF, DUCT
  component text not null,       -- Capacitor, Coil, Motor, etc.
  action text not null,          -- Replace, Reset, Repair, Clean, etc.
  cat1 text,
  cat2 text,
  cat3 text,
  repair_code text not null,     -- Auto-built: "AHU · Capacitor · Replace"
  name text not null,
  repair_notes text,             -- Tech-facing steps on Work screen
  invoice_description text,      -- QB-ready boilerplate for customer invoice
  variable_pricing boolean not null default false,
  one_shot boolean not null default true,
  est_work_hours numeric(4,2),
  historic_price numeric(8,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Items (parts, labor, materials, equipment, profit)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('equipment','part','material_bundle','labor','profit')),
  unit_cost numeric(8,2) not null default 0.00,
  is_placeholder boolean not null default false,
  unit text,                     -- each, hour, lb, ft, etc.
  alacarte_eligible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Repair bundles (one per diagnosis)
create table public.repair_bundles (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.diagnoses(id),
  name text not null,
  flat_rate numeric(8,2),
  addon_eligible boolean not null default false,
  addon_description text,
  notes text,
  created_at timestamptz not null default now()
);

-- Repair bundle lines (items within a bundle)
create table public.repair_bundle_lines (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.repair_bundles(id),
  item_id uuid not null references public.items(id),
  quantity numeric(8,2) not null default 1,
  cost_at_build numeric(8,2) not null  -- locked at bundle creation
);
