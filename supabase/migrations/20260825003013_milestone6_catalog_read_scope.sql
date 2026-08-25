-- Unit-scoped catalog read for 5S and Gemba.

create or replace function private.can_read_five_s_catalog(
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
    'five_s.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'five_s.read',
    private.current_membership_id(target_organisation_id),
    null
  )
  or exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = 'five_s.read'
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type in ('organisation', 'unit_subtree')
  )
$$;

create or replace function private.can_read_gemba_catalog(
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
    'gemba.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'gemba.read',
    private.current_membership_id(target_organisation_id),
    null
  )
  or exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = 'gemba.read'
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type in ('organisation', 'unit_subtree')
  )
$$;

alter function private.can_read_five_s_catalog(uuid)
  owner to lean_hub_private_owner;
alter function private.can_read_gemba_catalog(uuid)
  owner to lean_hub_private_owner;
