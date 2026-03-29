-- ============================================================
-- Seed: Refrigerant Profiles
-- Starting values — edit via admin UI as field knowledge evolves.
-- Baseline: ~95°F outdoor / 75°F return air.
-- ============================================================

insert into public.refrigerant_profiles
  (refrigerant_type, metering_device, outdoor_temp_min, outdoor_temp_max,
   suction_pressure_min, suction_pressure_max,
   discharge_pressure_min, discharge_pressure_max,
   superheat_min, superheat_max,
   suction_line_note, warning_note)
values
  ('R-410A', 'TXV',          80, 105,  115, 130,  380, 430,   8, 12,
   'Cold, sweating — not frosted', null),

  ('R-410A', 'fixed_orifice', 80, 105,  115, 130,  380, 430,  10, 18,
   'Cold, sweating — not frosted', null),

  ('R-22',   'TXV',          80, 105,   58,  68,  225, 265,   8, 12,
   'Cold, sweating — not frosted', null),

  ('R-22',   'fixed_orifice', 80, 105,   58,  68,  225, 265,  10, 18,
   'Cold, sweating — not frosted', null),

  ('R-32',   'TXV',          80, 105,  170, 195,  480, 540,   6, 10,
   'Cold, sweating — not frosted',
   'R-32 runs ~45% higher pressures than R-410A at the same temps. These readings are normal for R-32.'),

  ('R-32',   'fixed_orifice', 80, 105,  170, 195,  480, 540,  10, 15,
   'Cold, sweating — not frosted',
   'R-32 runs ~45% higher pressures than R-410A at the same temps. These readings are normal for R-32.');
