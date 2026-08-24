do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'lean_hub_private_owner'
  ) then
    create role lean_hub_private_owner
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls;
  end if;
end
$$;

grant lean_hub_private_owner to postgres;

create schema if not exists private authorization lean_hub_private_owner;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role lean_hub_private_owner in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role lean_hub_private_owner in schema private
  revoke execute on functions from public, anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.prevent_organisation_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'organisation_id is immutable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_update_or_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

create or replace function private.safe_uuid(value text)
returns uuid
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when pg_catalog.pg_input_is_valid(value, 'uuid')
      then value::uuid
    else null
  end
$$;

alter function private.touch_updated_at() owner to lean_hub_private_owner;
alter function private.prevent_organisation_id_change() owner to lean_hub_private_owner;
alter function private.prevent_update_or_delete() owner to lean_hub_private_owner;
alter function private.safe_uuid(text) owner to lean_hub_private_owner;

revoke all on all functions in schema private from public, anon, authenticated;
