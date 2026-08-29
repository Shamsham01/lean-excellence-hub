-- M1 workforce provisioning permissions (Owner + Organisation Administrator only).

insert into public.permission_definitions (permission_key, description, is_protected)
values
  (
    'workforce.provision',
    'Create workforce users with system-generated temporary credentials.',
    false
  ),
  (
    'workforce.credentials.reset',
    'Issue a new temporary password for an organisation-stewarded workforce identity.',
    false
  )
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'workforce.provision',
    'workforce.credentials.reset'
  ]::text[]
);

create or replace function private.system_upgrade_role_permissions_by_canonical_name(
  target_role_canonical_name text,
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
  target_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  actor_membership_id uuid;
begin
  for org_row in
    select organisation.id as organisation_id
    from public.organisations organisation
    where organisation.status in ('active', 'provisioning', 'suspended')
  loop
    select role_row.id
    into target_role_id
    from public.roles role_row
    where role_row.organisation_id = org_row.organisation_id
      and role_row.canonical_name = target_role_canonical_name
      and role_row.status = 'active'
    limit 1;

    if target_role_id is null then
      continue;
    end if;

    select role_version.id, role_version.version_number
    into current_published_version_id, current_version_number
    from public.role_versions role_version
    where role_version.organisation_id = org_row.organisation_id
      and role_version.role_id = target_role_id
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
    into actor_membership_id
    from public.organisation_memberships membership
    join public.access_grants active_grant
      on active_grant.organisation_id = membership.organisation_id
     and active_grant.grantee_membership_id = membership.id
     and active_grant.role_version_id = current_published_version_id
     and active_grant.status = 'active'
    where membership.organisation_id = org_row.organisation_id
      and membership.status = 'active'
    limit 1;

    if actor_membership_id is null then
      select membership.id
      into actor_membership_id
      from public.organisation_memberships membership
      where membership.organisation_id = org_row.organisation_id
        and membership.status = 'active'
      order by membership.created_at
      limit 1;
    end if;

    if actor_membership_id is null then
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
      target_role_id,
      current_version_number + 1,
      'draft',
      actor_membership_id
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

    insert into public.role_permissions (
      organisation_id,
      role_version_id,
      permission_key
    )
    select
      org_row.organisation_id,
      successor_version_id,
      missing_permission.permission_key
    from unnest(new_permission_keys) as missing_permission(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.organisation_id = org_row.organisation_id
        and role_permission.role_version_id = successor_version_id
        and role_permission.permission_key = missing_permission.permission_key
    );

    update public.role_versions
    set status = 'retired',
        retired_at = statement_timestamp(),
        retired_by_membership_id = actor_membership_id
    where organisation_id = org_row.organisation_id
      and id = current_published_version_id;

    update public.role_versions
    set status = 'published',
        published_by_membership_id = actor_membership_id,
        published_at = statement_timestamp()
    where id = successor_version_id
      and organisation_id = org_row.organisation_id;

    for active_grant_row in
      select active_grant.id as grant_id
      from public.access_grants active_grant
      where active_grant.organisation_id = org_row.organisation_id
        and active_grant.role_version_id = current_published_version_id
        and active_grant.status = 'active'
    loop
      update public.access_grants active_grant
      set role_version_id = successor_version_id
      where active_grant.id = active_grant_row.grant_id
        and active_grant.organisation_id = org_row.organisation_id;
    end loop;
  end loop;
end;
$$;

select private.system_upgrade_role_permissions_by_canonical_name(
  'organisation-administrator',
  array[
    'workforce.provision',
    'workforce.credentials.reset'
  ]::text[]
);

create or replace function private.ensure_baseline_role_permissions(
  target_organisation_id uuid,
  target_role_canonical_name text,
  required_permission_keys text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  actor_membership_id uuid;
  active_grant_row record;
begin
  select role_row.id
  into target_role_id
  from public.roles role_row
  where role_row.organisation_id = target_organisation_id
    and role_row.canonical_name = target_role_canonical_name
    and role_row.status = 'active'
  limit 1;

  if target_role_id is null then
    return;
  end if;

  select role_version.id, role_version.version_number
  into current_published_version_id, current_version_number
  from public.role_versions role_version
  where role_version.organisation_id = target_organisation_id
    and role_version.role_id = target_role_id
    and role_version.status = 'published'
  order by role_version.version_number desc
  limit 1;

  if current_published_version_id is null then
    return;
  end if;

  if not exists (
    select 1
    from unnest(required_permission_keys) as required_permission(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.organisation_id = target_organisation_id
        and role_permission.role_version_id = current_published_version_id
        and role_permission.permission_key = required_permission.permission_key
    )
  ) then
    return;
  end if;

  select membership.id
  into actor_membership_id
  from public.organisation_memberships membership
  where membership.organisation_id = target_organisation_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  if actor_membership_id is null then
    return;
  end if;

  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    target_organisation_id,
    target_role_id,
    current_version_number + 1,
    'draft',
    actor_membership_id
  )
  returning id into successor_version_id;

  insert into public.role_permissions (
    organisation_id,
    role_version_id,
    permission_key
  )
  select
    target_organisation_id,
    successor_version_id,
    role_permission.permission_key
  from public.role_permissions role_permission
  where role_permission.organisation_id = target_organisation_id
    and role_permission.role_version_id = current_published_version_id;

  insert into public.role_permissions (
    organisation_id,
    role_version_id,
    permission_key
  )
  select
    target_organisation_id,
    successor_version_id,
    required_permission.permission_key
  from unnest(required_permission_keys) as required_permission(permission_key)
  where not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = successor_version_id
      and role_permission.permission_key = required_permission.permission_key
  );

  update public.role_versions
  set status = 'retired',
      retired_at = statement_timestamp(),
      retired_by_membership_id = actor_membership_id
  where organisation_id = target_organisation_id
    and id = current_published_version_id;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where id = successor_version_id
    and organisation_id = target_organisation_id;

  for active_grant_row in
    select active_grant.id as grant_id
    from public.access_grants active_grant
    where active_grant.organisation_id = target_organisation_id
      and active_grant.role_version_id = current_published_version_id
      and active_grant.status = 'active'
  loop
    update public.access_grants active_grant
    set role_version_id = successor_version_id
    where active_grant.id = active_grant_row.grant_id
      and active_grant.organisation_id = target_organisation_id;
  end loop;
end;
$$;

do $rename$
begin
  if to_regprocedure('private.ensure_organisation_baseline_application_roles$m1(uuid,uuid)') is null
    and to_regprocedure('private.ensure_organisation_baseline_application_roles(uuid,uuid)') is not null then
    alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
      rename to ensure_organisation_baseline_application_roles$m1;
  end if;
end;
$rename$;

create or replace function private.ensure_organisation_baseline_application_roles(
  target_organisation_id uuid,
  actor_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.ensure_organisation_baseline_application_roles$m1(
    target_organisation_id,
    actor_membership_id
  );

  perform private.ensure_baseline_role_permissions(
    target_organisation_id,
    'organisation-administrator',
    array['workforce.provision', 'workforce.credentials.reset']::text[]
  );
end;
$$;

alter function private.ensure_baseline_role_permissions(uuid, text, text[])
  owner to lean_hub_private_owner;
alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
  owner to lean_hub_private_owner;

revoke all on function private.ensure_baseline_role_permissions(uuid, text, text[])
  from public, anon, authenticated, service_role;

alter function private.system_upgrade_role_permissions_by_canonical_name(text, text[])
  owner to lean_hub_private_owner;

revoke all on function private.system_upgrade_role_permissions_by_canonical_name(text, text[])
  from public, anon, authenticated, service_role;
