-- Idempotent upgrade: add missing problem-solving permissions to the Apex plant-manager role.
do $$
declare
  target_org_id uuid;
  target_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  owner_membership_id uuid;
  missing_permission text;
  required_permissions text[] := array[
    'problem_solving.view',
    'problem_solving.create',
    'problem_solving.contribute',
    'problem_solving.manage',
    'problem_solving.facilitate',
    'problem_solving.verify_cause',
    'problem_solving.close',
    'ai.use',
    'ai.view_history'
  ];
  active_grant_row record;
begin
  select organisation.id
  into target_org_id
  from public.organisations organisation
  where organisation.code = 'apex-manufacturing'
  limit 1;

  if target_org_id is null then
    return;
  end if;

  select role_row.id
  into target_role_id
  from public.roles role_row
  where role_row.organisation_id = target_org_id
    and role_row.canonical_name = 'plant-manager'
    and role_row.status = 'active'
  limit 1;

  if target_role_id is null then
    return;
  end if;

  select role_version.id, role_version.version_number
  into current_published_version_id, current_version_number
  from public.role_versions role_version
  where role_version.organisation_id = target_org_id
    and role_version.role_id = target_role_id
    and role_version.status = 'published'
  order by role_version.version_number desc
  limit 1;

  if current_published_version_id is null then
    return;
  end if;

  if not exists (
    select 1
    from unnest(required_permissions) as required_permission(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.organisation_id = target_org_id
        and role_permission.role_version_id = current_published_version_id
        and role_permission.permission_key = required_permission.permission_key
    )
  ) then
    return;
  end if;

  select membership.id
  into owner_membership_id
  from public.organisation_memberships membership
  join public.access_grants active_owner_grant
    on active_owner_grant.organisation_id = membership.organisation_id
   and active_owner_grant.grantee_membership_id = membership.id
   and active_owner_grant.role_version_id = current_published_version_id
   and active_owner_grant.status = 'active'
  where membership.organisation_id = target_org_id
    and membership.status = 'active'
  limit 1;

  if owner_membership_id is null then
    select membership.id
    into owner_membership_id
    from public.organisation_memberships membership
    where membership.organisation_id = target_org_id
      and membership.status = 'active'
    order by membership.created_at
    limit 1;
  end if;

  if owner_membership_id is null then
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
    target_org_id,
    target_role_id,
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
    target_org_id,
    successor_version_id,
    role_permission.permission_key
  from public.role_permissions role_permission
  where role_permission.organisation_id = target_org_id
    and role_permission.role_version_id = current_published_version_id;

  foreach missing_permission in array required_permissions
  loop
    insert into public.role_permissions (
      organisation_id,
      role_version_id,
      permission_key
    )
    select
      target_org_id,
      successor_version_id,
      missing_permission
    where not exists (
      select 1
      from public.role_permissions existing_permission
      where existing_permission.organisation_id = target_org_id
        and existing_permission.role_version_id = successor_version_id
        and existing_permission.permission_key = missing_permission
    );
  end loop;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = owner_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_org_id
    and id = successor_version_id;

  for active_grant_row in
    select active_grant.*
    from public.access_grants active_grant
    where active_grant.organisation_id = target_org_id
      and active_grant.role_version_id = current_published_version_id
      and active_grant.status = 'active'
  loop
    update public.access_grants bound_grant
    set status = 'revoked',
        revoked_at = statement_timestamp(),
        revoked_by_membership_id = owner_membership_id,
        revocation_reason = 'demo plant-manager problem-solving and ai permission upgrade'
    where bound_grant.organisation_id = target_org_id
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
end;
$$;
