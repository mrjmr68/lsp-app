-- ============================================================
-- Migration 005: Extend systems table
-- Adds group_name, tonnage, and system_subtype
--
-- group_name     — links related components within a unit
--                  e.g. AHU and CU both get group_name = 'Heat Pump A'
--                  A standalone RTU needs no group_name
-- tonnage        — nominal capacity (1.5, 2, 3, 5, 10, etc.)
-- system_subtype — physical form factor of this component
--
-- system_subtype values:
--   RTU       — packaged rooftop unit (one cabinet, all-in-one)
--   CU        — condensing unit (outdoor half of a split system)
--   AHU       — air handler (indoor half of a split system)
--   MS-Head   — mini-split indoor head
--   MS-Cond   — mini-split outdoor condenser
--   PTAC      — packaged terminal (wall unit)
-- ============================================================

alter table public.systems
  add column group_name text,
  add column tonnage numeric(4,1),
  add column system_subtype text check (
    system_subtype in ('RTU', 'CU', 'AHU', 'MS-Head', 'MS-Cond', 'PTAC')
  );
