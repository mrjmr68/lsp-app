-- ============================================================
-- Migration 007: Diagnoses — auto-generated repair_code, drop name
--
-- repair_code is a generated column built from:
--   location - component - action - cat1 - cat2 - cat3
-- Null/blank category fields are skipped gracefully.
-- name column is dropped — repair_code is the display label.
--
-- NOTE: Postgres generated columns require all functions used to be
-- declared IMMUTABLE. concat_ws and nullif are immutable, but trim()
-- on column references is not recognised as such in this context.
-- The solution is to declare an explicit IMMUTABLE helper function
-- and call that from the generated column expression.
-- ============================================================

-- Step 1: Create an immutable helper function in the public schema
create or replace function public.build_repair_code(
  loc  text,
  comp text,
  act  text,
  c1   text,
  c2   text,
  c3   text
)
returns text
language sql
immutable
parallel safe
as $$
  select concat_ws(' - ',
    nullif(loc,  ''),
    nullif(comp, ''),
    nullif(act,  ''),
    nullif(c1,   ''),
    nullif(c2,   ''),
    nullif(c3,   '')
  )
$$;

-- Step 2: Drop the old columns
alter table public.diagnoses drop column name;
alter table public.diagnoses drop column repair_code;

-- Step 3: Add repair_code as a generated column using the immutable function
alter table public.diagnoses
  add column repair_code text generated always as (
    public.build_repair_code(location, component, action, cat1, cat2, cat3)
  ) stored;

comment on column public.diagnoses.repair_code is
  'Auto-generated from location, component, action, cat1, cat2, cat3 via build_repair_code(). Never set manually.';
