-- ============================================================
-- Migration 025: Parts sourcing and vendor communication
-- Track needed parts, vendor details, ETA, and optional vendor email
-- inside the same originating job lifecycle.
-- ============================================================

create table if not exists public.job_parts_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  vendor_name text,
  vendor_email text,
  eta_date date,
  vendor_notes text,
  email_subject text,
  email_body text,
  vendor_email_sent_at timestamptz,
  vendor_email_sent_by uuid references public.users(id),
  ordered_at timestamptz,
  ordered_by uuid references public.users(id),
  ready_to_schedule_at timestamptz,
  ready_to_schedule_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_parts_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_parts_requests(id) on delete cascade,
  item_id uuid references public.items(id),
  part_name text not null,
  part_number text,
  quantity numeric(8,2) not null default 1,
  unit_cost numeric(8,2),
  notes text,
  ordered boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists job_parts_requests_job_idx
  on public.job_parts_requests(job_id);

create index if not exists job_parts_request_lines_request_idx
  on public.job_parts_request_lines(request_id, sort_order, created_at);

create or replace function public.touch_job_parts_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_parts_requests_touch_updated_at on public.job_parts_requests;

create trigger job_parts_requests_touch_updated_at
  before update on public.job_parts_requests
  for each row execute procedure public.touch_job_parts_request_updated_at();

alter table public.job_parts_requests enable row level security;
alter table public.job_parts_request_lines enable row level security;

drop policy if exists "Owner and admin read parts requests" on public.job_parts_requests;
create policy "Owner and admin read parts requests"
  on public.job_parts_requests for select
  using (public.is_owner_or_admin());

drop policy if exists "Owner and admin manage parts requests" on public.job_parts_requests;
create policy "Owner and admin manage parts requests"
  on public.job_parts_requests for all
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

drop policy if exists "Owner and admin read parts request lines" on public.job_parts_request_lines;
create policy "Owner and admin read parts request lines"
  on public.job_parts_request_lines for select
  using (
    exists (
      select 1
      from public.job_parts_requests
      where public.job_parts_requests.id = job_parts_request_lines.request_id
        and public.is_owner_or_admin()
    )
  );

drop policy if exists "Owner and admin manage parts request lines" on public.job_parts_request_lines;
create policy "Owner and admin manage parts request lines"
  on public.job_parts_request_lines for all
  using (
    exists (
      select 1
      from public.job_parts_requests
      where public.job_parts_requests.id = job_parts_request_lines.request_id
        and public.is_owner_or_admin()
    )
  )
  with check (
    exists (
      select 1
      from public.job_parts_requests
      where public.job_parts_requests.id = job_parts_request_lines.request_id
        and public.is_owner_or_admin()
    )
  );
