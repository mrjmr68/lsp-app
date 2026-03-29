-- ============================================================
-- Migration 001: Core entities
-- app_config, refrigerant_profile, users, customers,
-- locations, units, systems, persons, contacts, schedule_blocks
-- ============================================================

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  role text not null check (role in ('tech','dispatcher','admin','owner')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- App-wide pricing constants (single row)
create table public.app_config (
  id integer primary key default 1 check (id = 1),
  labor_cost_per_hour numeric(8,2) not null default 90.00,
  travel_time_hours numeric(4,2) not null default 0.5,
  refrigerant_cost_per_lb numeric(8,2) not null default 15.00,
  profit_per_hour_target numeric(8,2) not null default 100.00,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

-- Refrigerant rules-of-thumb profiles (data-driven, no code change to update)
create table public.refrigerant_profiles (
  id uuid primary key default gen_random_uuid(),
  refrigerant_type text not null check (refrigerant_type in ('R-410A','R-22','R-32','other')),
  metering_device text not null check (metering_device in ('TXV','fixed_orifice','other')),
  outdoor_temp_min integer,
  outdoor_temp_max integer,
  suction_pressure_min numeric(6,1),
  suction_pressure_max numeric(6,1),
  discharge_pressure_min numeric(6,1),
  discharge_pressure_max numeric(6,1),
  superheat_min numeric(5,1),
  superheat_max numeric(5,1),
  suction_line_note text,
  warning_note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Customers (self-referencing for parent/child hierarchy)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.customers(id),
  name text not null,
  type text check (type in ('residential','commercial','property_management','facilities_provider')),
  billing_address text,
  billing_email text,
  billing_phone text,
  bill_to_parent boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Locations (properties where work happens)
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  name text not null,
  street_address text,
  city text,
  state text,
  zip text,
  access_notes text,
  created_at timestamptz not null default now()
);

-- Units (addressable spaces within a location)
create table public.units (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null,
  unit_type text check (unit_type in ('apartment','suite','floor','main')),
  notes text,
  created_at timestamptz not null default now()
);

-- Systems (HVAC equipment at a unit)
create table public.systems (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  name text not null,
  system_type text,
  make text,
  model text,
  serial_number text,
  refrigerant_type text check (refrigerant_type in ('R-410A','R-22','R-32','other')),
  metering_device text check (metering_device in ('TXV','fixed_orifice','other')),
  install_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Persons (contacts for customers and locations)
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  title text,
  created_at timestamptz not null default now()
);

-- Customer contacts
create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  person_id uuid not null references public.persons(id),
  role text,
  is_primary boolean not null default false
);

-- Schedule blocks (tech unavailability)
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason in ('vacation','training','sick','other')),
  notes text
);
