-- ============================================================
-- Migration 011: User profile sync + assignable users helpers
-- ============================================================

create or replace function public.ensure_user_profile(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  source_user auth.users%rowtype;
  normalized_role text;
  fallback_role text;
  full_name text;
  first_name text;
  last_name text;
begin
  select *
  into source_user
  from auth.users
  where id = p_user_id;

  if not found then
    return null;
  end if;

  select case
    when exists (select 1 from public.users) then 'tech'
    else 'owner'
  end
  into fallback_role;

  normalized_role := lower(
    coalesce(
      nullif(source_user.raw_app_meta_data ->> 'role', ''),
      nullif(source_user.raw_user_meta_data ->> 'role', ''),
      fallback_role
    )
  );

  if normalized_role not in ('tech', 'dispatcher', 'admin', 'owner') then
    normalized_role := fallback_role;
  end if;

  full_name := nullif(
    trim(
      coalesce(
        source_user.raw_user_meta_data ->> 'full_name',
        source_user.raw_user_meta_data ->> 'name'
      )
    ),
    ''
  );

  first_name := nullif(
    trim(
      coalesce(
        source_user.raw_user_meta_data ->> 'first_name',
        split_part(full_name, ' ', 1),
        split_part(source_user.email, '@', 1)
      )
    ),
    ''
  );

  last_name := nullif(
    trim(
      coalesce(
        source_user.raw_user_meta_data ->> 'last_name',
        case
          when full_name is not null and position(' ' in full_name) > 0
            then substr(full_name, position(' ' in full_name) + 1)
          else null
        end,
        'User'
      )
    ),
    ''
  );

  insert into public.users (id, first_name, last_name, role, active)
  values (
    source_user.id,
    coalesce(first_name, 'Field'),
    coalesce(last_name, 'User'),
    normalized_role,
    true
  )
  on conflict (id) do nothing;

  return source_user.id;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_user_profile(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_auth_user_created();

create or replace function public.backfill_missing_user_profiles()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  source_user record;
  inserted_count integer := 0;
begin
  for source_user in
    select au.id
    from auth.users au
    left join public.users pu on pu.id = au.id
    where pu.id is null
  loop
    perform public.ensure_user_profile(source_user.id);
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.list_assignable_users()
returns table (
  id uuid,
  first_name text,
  last_name text,
  role text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    users.id,
    users.first_name,
    users.last_name,
    users.role,
    users.active
  from public.users
  where users.active = true
    and users.role in ('tech', 'dispatcher', 'admin', 'owner')
  order by users.first_name, users.last_name;
$$;

grant execute on function public.ensure_user_profile(uuid) to authenticated;
grant execute on function public.backfill_missing_user_profiles() to authenticated;
grant execute on function public.list_assignable_users() to authenticated;
