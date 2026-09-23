-- Batch permission probe for platform shell SSR (PERF-001).
-- Mirrors public.member_has_permission semantics for each requested key.

create or replace function public.member_has_permissions(
  target_permission_keys text[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct key as permission_key
    from unnest(coalesce(target_permission_keys, '{}'::text[])) as key
    where key is not null
      and btrim(key) <> ''
  ),
  org_context as (
    select
      private.current_organisation_id() as org_id,
      private.current_membership_id(private.current_organisation_id()) as membership_id
  ),
  grant_granted as (
    select distinct role_permission.permission_key
    from org_context ctx
    cross join public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = any(target_permission_keys)
    where ctx.org_id is not null
      and ctx.membership_id is not null
      and grant_row.organisation_id = ctx.org_id
      and grant_row.grantee_membership_id = ctx.membership_id
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
  ),
  baseline_granted as (
    select bpp.permission_key
    from org_context ctx
    cross join private.baseline_participation_permissions bpp
    join public.organisation_memberships actor_membership
      on actor_membership.id = ctx.membership_id
     and actor_membership.organisation_id = ctx.org_id
     and actor_membership.status = 'active'
    join public.organisations organisation
      on organisation.id = actor_membership.organisation_id
     and organisation.status = 'active'
    join private.identity_controls identity_control
      on identity_control.user_id = actor_membership.user_id
     and identity_control.status = 'active'
     and identity_control.enrolment_status = 'complete'
    where ctx.org_id is not null
      and ctx.membership_id is not null
      and bpp.permission_key = any(target_permission_keys)
  ),
  resolved as (
    select
      requested.permission_key,
      (
        exists (
          select 1
          from grant_granted granted
          where granted.permission_key = requested.permission_key
        )
        or exists (
          select 1
          from baseline_granted granted
          where granted.permission_key = requested.permission_key
        )
      ) as granted
    from requested
  )
  select coalesce(
    jsonb_object_agg(permission_key, granted),
    '{}'::jsonb
  )
  from resolved
$$;

grant execute on function public.member_has_permissions(text[]) to authenticated;
