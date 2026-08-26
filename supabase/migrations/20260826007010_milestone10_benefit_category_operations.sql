-- Milestone 10: benefit category operations, reporting settings, overlap audit fix.

create or replace function private.can_manage_benefit_categories(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.categories.manage',
    null,
    null
  )
$$;

create or replace function private.can_read_benefit_categories(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.create',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.manage',
    null,
    null
  )
  or private.can_manage_benefit_categories(target_organisation_id)
$$;

create policy benefit_categories_select
on public.benefit_categories for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_benefit_categories(organisation_id)
);

create policy benefit_reporting_settings_select
on public.benefit_reporting_settings for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_benefit_categories(organisation_id)
);

grant select on public.benefit_categories to authenticated;
grant select on public.benefit_reporting_settings to authenticated;

create or replace function private.create_benefit_category(
  target_name text,
  target_code text,
  target_description text default null,
  target_display_order integer default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_category_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.benefit_categories (
    organisation_id,
    name,
    code,
    description,
    display_order,
    status
  )
  values (
    org_id,
    btrim(target_name),
    btrim(target_code),
    target_description,
    target_display_order,
    'active'
  )
  returning id into new_category_id;

  perform private.append_business_audit(
    org_id,
    'benefit_category.created',
    null,
    'succeeded',
    jsonb_build_object('category_id', new_category_id)
  );

  return new_category_id;
end;
$$;

create or replace function private.update_benefit_category(
  target_category_id uuid,
  target_name text,
  target_description text default null,
  target_display_order integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category update is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_categories category_table
  set
    name = btrim(target_name),
    description = target_description,
    display_order = coalesce(target_display_order, category_table.display_order)
  where category_table.organisation_id = org_id
    and category_table.id = target_category_id;

  if not found then
    raise exception 'benefit category not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.archive_benefit_category(
  target_category_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category archive is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_categories category_table
  set status = 'archived'
  where category_table.organisation_id = org_id
    and category_table.id = target_category_id;

  if not found then
    raise exception 'benefit category not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.upsert_benefit_reporting_settings(
  target_fiscal_year_start_month integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit reporting settings update is not authorised'
      using errcode = '42501';
  end if;

  if target_fiscal_year_start_month < 1 or target_fiscal_year_start_month > 12 then
    raise exception 'fiscal year start month must be between 1 and 12'
      using errcode = '22023';
  end if;

  insert into public.benefit_reporting_settings (
    organisation_id,
    fiscal_year_start_month,
    created_by_membership_id,
    updated_by_membership_id
  )
  values (
    org_id,
    target_fiscal_year_start_month,
    actor_membership_id,
    actor_membership_id
  )
  on conflict (organisation_id) do update
  set
    fiscal_year_start_month = excluded.fiscal_year_start_month,
    updated_by_membership_id = actor_membership_id,
    updated_at = statement_timestamp();

  return true;
end;
$$;

create or replace function private.create_benefit_overlap_group(
  target_name text,
  target_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_group_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_overlap(org_id) then
    raise exception 'benefit overlap group creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.benefit_overlap_groups (
    organisation_id,
    name,
    reason,
    created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    target_reason,
    actor_membership_id
  )
  returning id into new_group_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_group.created',
    null,
    'succeeded',
    jsonb_build_object('overlap_group_id', new_group_id)
  );

  return new_group_id;
end;
$$;

create or replace function public.create_benefit_category(
  target_name text,
  target_code text,
  target_description text default null,
  target_display_order integer default 0
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_benefit_category(
    target_name,
    target_code,
    target_description,
    target_display_order
  )
$$;

create or replace function public.update_benefit_category(
  target_category_id uuid,
  target_name text,
  target_description text default null,
  target_display_order integer default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_benefit_category(
    target_category_id,
    target_name,
    target_description,
    target_display_order
  )
$$;

create or replace function public.archive_benefit_category(target_category_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.archive_benefit_category(target_category_id) $$;

create or replace function public.upsert_benefit_reporting_settings(
  target_fiscal_year_start_month integer
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.upsert_benefit_reporting_settings(target_fiscal_year_start_month) $$;

grant execute on function public.create_benefit_category(text, text, text, integer) to authenticated;
grant execute on function public.update_benefit_category(uuid, text, text, integer) to authenticated;
grant execute on function public.archive_benefit_category(uuid) to authenticated;
grant execute on function public.upsert_benefit_reporting_settings(integer) to authenticated;

revoke all on function public.create_benefit_category(text, text, text, integer) from public, anon;
revoke all on function public.update_benefit_category(uuid, text, text, integer) from public, anon;
revoke all on function public.archive_benefit_category(uuid) from public, anon;
revoke all on function public.upsert_benefit_reporting_settings(integer) from public, anon;

alter function private.create_benefit_category(text, text, text, integer) owner to lean_hub_private_owner;
alter function private.update_benefit_category(uuid, text, text, integer) owner to lean_hub_private_owner;
alter function private.archive_benefit_category(uuid) owner to lean_hub_private_owner;
alter function private.upsert_benefit_reporting_settings(integer) owner to lean_hub_private_owner;
alter function private.can_manage_benefit_categories(uuid) owner to lean_hub_private_owner;
alter function private.can_read_benefit_categories(uuid) owner to lean_hub_private_owner;
