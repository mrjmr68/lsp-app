-- ============================================================
-- Migration 016: Component-specific ratings
-- Adds a BTU field so furnace components can store heating input.
-- ============================================================

alter table public.systems
  add column if not exists heating_capacity_btu numeric;
