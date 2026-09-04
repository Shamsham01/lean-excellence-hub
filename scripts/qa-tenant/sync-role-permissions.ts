import { QA_ORGANISATION_CODE, QA_ROLES } from "./constants";
import { runSupabaseDbQuery } from "./db-cli";

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTextArray(values: readonly string[]) {
  if (values.length === 0) {
    return "array[]::text[]";
  }

  return `array[${values.map((value) => sqlLiteral(value)).join(", ")}]::text[]`;
}

export function syncCookieWorksRolePermissions(
  databaseUrl: string,
  roleKey: keyof typeof QA_ROLES,
) {
  const role = QA_ROLES[roleKey];

  runSupabaseDbQuery({
    databaseUrl,
    sql: `
do $$
declare
  target_org_id uuid;
  target_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  owner_membership_id uuid;
  missing_permission text;
  required_permissions text[] := ${sqlTextArray(role.permissions)};
  active_grant_row record;
begin
  select organisation.id
  into target_org_id
  from public.organisations organisation
  where organisation.code = ${sqlLiteral(QA_ORGANISATION_CODE)}
  limit 1;

  if target_org_id is null then
    return;
  end if;

  select role_row.id
  into target_role_id
  from public.roles role_row
  where role_row.organisation_id = target_org_id
    and role_row.canonical_name = ${sqlLiteral(role.canonicalName)}
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
  join public.roles owner_role
    on owner_role.organisation_id = membership.organisation_id
   and owner_role.is_owner_role
  join public.role_versions owner_role_version
    on owner_role_version.organisation_id = owner_role.organisation_id
   and owner_role_version.role_id = owner_role.id
   and owner_role_version.status = 'published'
  join public.access_grants owner_grant
    on owner_grant.organisation_id = membership.organisation_id
   and owner_grant.grantee_membership_id = membership.id
   and owner_grant.role_version_id = owner_role_version.id
   and owner_grant.status = 'active'
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
  set status = 'retired',
      retired_at = statement_timestamp(),
      retired_by_membership_id = owner_membership_id
  where organisation_id = target_org_id
    and id = current_published_version_id;

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
        revocation_reason = 'CookieWorks QA role permission sync'
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
`,
  });
}

export function syncAllCookieWorksRolePermissions(databaseUrl: string) {
  for (const roleKey of Object.keys(QA_ROLES) as Array<keyof typeof QA_ROLES>) {
    syncCookieWorksRolePermissions(databaseUrl, roleKey);
  }
}
