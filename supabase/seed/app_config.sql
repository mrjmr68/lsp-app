-- ============================================================
-- Seed: App Config
-- Single row — update via admin UI, never re-run this file.
-- ============================================================

insert into public.app_config
  (id, labor_cost_per_hour, travel_time_hours, refrigerant_cost_per_lb, profit_per_hour_target)
values
  (1, 90.00, 0.50, 15.00, 100.00)
on conflict (id) do nothing;
