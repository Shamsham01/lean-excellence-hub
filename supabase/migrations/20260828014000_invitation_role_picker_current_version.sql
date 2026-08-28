-- Invitation role picker: expose only the current published role version per role.
-- Fixes accumulated published owner versions from permission upgrades that did not
-- retire superseded versions.

-- Retire superseded published role versions that accumulated before this fix.
update public.role_versions superseded
set status = 'retired',
    retired_at = statement_timestamp(),
    retired_by_membership_id = superseded.published_by_membership_id
where superseded.status = 'published'
  and exists (
    select 1
    from public.role_versions newer
    where newer.organisation_id = superseded.organisation_id
      and newer.role_id = superseded.role_id
      and newer.status = 'published'
      and newer.version_number > superseded.version_number
  );

create or replace function private.system_upgrade_owner_role_permissions(
  new_permission_keys text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_row record;
  active_grant_row record;
  owner_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  owner_membership_id uuid;
  missing_key text;
begin
  for org_row in
    select organisation.id as organisation_id
    from public.organisations organisation
    where organisation.status in ('active', 'provisioning', 'suspended')
  loop
    select role_row.id
    into owner_role_id
    from public.roles role_row
    where role_row.organisation_id = org_row.organisation_id
      and role_row.is_owner_role
      and role_row.status = 'active'
    limit 1;

    if owner_role_id is null then
      continue;
    end if;

    select role_version.id, role_version.version_number
    into current_published_version_id, current_version_number
    from public.role_versions role_version
    where role_version.organisation_id = org_row.organisation_id
      and role_version.role_id = owner_role_id
      and role_version.status = 'published'
    order by role_version.version_number desc
    limit 1;

    if current_published_version_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from unnest(new_permission_keys) as missing_permission(permission_key)
      where not exists (
        select 1
        from public.role_permissions role_permission
        where role_permission.organisation_id = org_row.organisation_id
          and role_permission.role_version_id = current_published_version_id
          and role_permission.permission_key = missing_permission.permission_key
      )
    ) then
      continue;
    end if;

    select membership.id
    into owner_membership_id
    from public.organisation_memberships membership
    join public.access_grants active_owner_grant
      on active_owner_grant.organisation_id = membership.organisation_id
     and active_owner_grant.grantee_membership_id = membership.id
     and active_owner_grant.role_version_id = current_published_version_id
     and active_owner_grant.status = 'active'
    where membership.organisation_id = org_row.organisation_id
      and membership.status = 'active'
    limit 1;

    if owner_membership_id is null then
      select membership.id
      into owner_membership_id
      from public.organisation_memberships membership
      where membership.organisation_id = org_row.organisation_id
        and membership.status = 'active'
      order by membership.created_at
      limit 1;
    end if;

    if owner_membership_id is null then
      continue;
    end if;

    insert into public.role_versions (
      organisation_id,
      role_id,
      version_number,
      status,
      created_by_membership_id
    )
    values (
      org_row.organisation_id,
      owner_role_id,
      current_version_number + 1,
      'draft',
      owner_membership_id
    )
    returning id into successor_version_id;

    insert into public.role_permissions (
      organisation_id,
      role_version_id,
      permission_key
    )
    select
      org_row.organisation_id,
      successor_version_id,
      role_permission.permission_key
    from public.role_permissions role_permission
    where role_permission.organisation_id = org_row.organisation_id
      and role_permission.role_version_id = current_published_version_id;

    foreach missing_key in array new_permission_keys
    loop
      insert into public.role_permissions (
        organisation_id,
        role_version_id,
        permission_key
      )
      select
        org_row.organisation_id,
        successor_version_id,
        missing_key
      where not exists (
        select 1
        from public.role_permissions existing_permission
        where existing_permission.organisation_id = org_row.organisation_id
          and existing_permission.role_version_id = successor_version_id
          and existing_permission.permission_key = missing_key
      );
    end loop;

    update public.role_versions
    set status = 'retired',
        retired_at = statement_timestamp(),
        retired_by_membership_id = owner_membership_id
    where organisation_id = org_row.organisation_id
      and id = current_published_version_id;

    update public.role_versions
    set status = 'published',
        published_by_membership_id = owner_membership_id,
        published_at = statement_timestamp()
    where organisation_id = org_row.organisation_id
      and id = successor_version_id;

    for active_grant_row in
      select active_grant.*
      from public.access_grants active_grant
      where active_grant.organisation_id = org_row.organisation_id
        and active_grant.role_version_id = current_published_version_id
        and active_grant.status = 'active'
    loop
      update public.access_grants bound_grant
      set status = 'revoked',
          revoked_at = statement_timestamp(),
          revoked_by_membership_id = owner_membership_id,
          revocation_reason = 'owner role permission upgrade'
      where bound_grant.organisation_id = org_row.organisation_id
        and bound_grant.id = active_grant_row.id;

      insert into public.access_grants (
        organisation_id,
        grantee_membership_id,
        role_version_id,
        scope_type,
        scope_unit_id,
        grantor_membership_id
      )
      values (
        active_grant_row.organisation_id,
        active_grant_row.grantee_membership_id,
        successor_version_id,
        active_grant_row.scope_type,
        active_grant_row.scope_unit_id,
        owner_membership_id
      );
    end loop;
  end loop;
end;
$$;

create or replace function private.publish_role_version(
  target_organisation_id uuid,
  target_role_version_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  target_role_id uuid;
  target_role_is_protected boolean;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      null
    ) then
    raise exception 'role publication is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select role_version.role_id, role_row.is_protected
  into target_role_id, target_role_is_protected
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'draft'
    and role_row.status = 'active'
  for update of role_version;

  if not found or not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
  ) then
    raise exception 'role version is not publishable'
      using errcode = '55000';
  end if;

  if target_role_is_protected
    and not private.current_membership_is_owner(target_organisation_id) then
    raise exception 'protected role publication requires an owner'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.role_permissions role_permission
    join public.permission_definitions permission
      on permission.permission_key = role_permission.permission_key
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and (
        (permission.is_protected and not target_role_is_protected)
        or not private.has_scoped_permission(
          target_organisation_id,
          role_permission.permission_key,
          null,
          null
        )
      )
  ) then
    raise exception 'role permissions exceed delegable authority'
      using errcode = '42501';
  end if;

  update public.role_versions
  set status = 'retired',
      retired_at = statement_timestamp(),
      retired_by_membership_id = actor_membership_id
  where organisation_id = target_organisation_id
    and role_id = target_role_id
    and status = 'published';

  update public.role_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = target_role_version_id;

  perform private.append_security_audit(
    target_organisation_id,
    'role.version_published',
    'role_version',
    target_role_version_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.get_delegatable_access_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  result jsonb := '[]'::jsonb;
  role_record record;
  scope_record record;
  scope_options jsonb;
  actor_can_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  select
    private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'roles.delegate',
      null,
      null
    )
    or exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
        and private.membership_has_scoped_permission(
          actor_membership_id,
          org_id,
          'roles.delegate',
          null,
          unit_row.id
        )
    )
  into actor_can_delegate;

  if not actor_can_delegate then
    return jsonb_build_object('offers', '[]'::jsonb);
  end if;

  for role_record in
    select distinct on (role_row.id)
      role_version.id as role_version_id,
      role_row.display_name as role_display_name,
      role_row.canonical_name as role_canonical_name,
      role_row.is_owner_role
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = org_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_owner_role
        or private.membership_is_effective_owner(
          actor_membership_id,
          org_id
        )
      )
    order by role_row.id, role_version.version_number desc
  loop
    scope_options := '[]'::jsonb;

    if private.role_version_is_delegatable_at_scope(
      org_id,
      role_record.role_version_id,
      'organisation',
      null,
      actor_membership_id
    ) and private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'roles.delegate',
      null,
      null
    ) then
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        )
      );
    end if;

    for scope_record in
      select unit_row.id, unit_row.name, unit_row.code
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
        and private.membership_has_scoped_permission(
          actor_membership_id,
          org_id,
          'roles.delegate',
          null,
          unit_row.id
        )
        and private.role_version_is_delegatable_at_scope(
          org_id,
          role_record.role_version_id,
          'unit_subtree',
          unit_row.id,
          actor_membership_id
        )
      order by unit_row.name
    loop
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'unit_subtree',
          'scope_unit_id', scope_record.id,
          'label', scope_record.name,
          'unit_code', scope_record.code
        )
      );
    end loop;

    if jsonb_array_length(scope_options) > 0 then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'role_version_id', role_record.role_version_id,
          'role_display_name', role_record.role_display_name,
          'role_canonical_name', role_record.role_canonical_name,
          'scope_options', scope_options
        )
      );
    end if;
  end loop;

  return jsonb_build_object('offers', result);
end;
$$;

alter function private.system_upgrade_owner_role_permissions(text[])
  owner to lean_hub_private_owner;
alter function private.publish_role_version(uuid, uuid)
  owner to lean_hub_private_owner;
