-- ============================================================
-- Migration 012: System context + derived manufacture date
-- ============================================================

alter table public.systems
  add column served_areas text,
  add column thermostat_location text,
  add column equipment_location text,
  add column controls_notes text,
  add column manufacture_date date,
  add column manufacture_date_source text;
