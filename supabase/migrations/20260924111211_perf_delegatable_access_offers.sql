-- PERF-001: replace roles × units nested permission probes in
-- get_delegatable_access_offers with one set-based coverage of the current
-- actor's effective permissions. Semantics stay bound to the same grant,
-- version, expiry, revocation, site-boundary, and baseline-participation
-- predicates as private.membership_has_scoped_permission.

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
  actor_is_owner boolean := false;
  actor_has_org_delegate boolean := false;
  actor_can_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  actor_is_owner := private.membership_is_effective_owner(
    actor_membership_id,
    org_id
  );

  actor_has_org_delegate := private.membership_has_scoped_permission(
    actor_membership_id,
    org_id,
    'roles.delegate',
    null,
    null
  );

  if actor_has_org_delegate then
    actor_can_delegate := true;
  else
    select exists (
      select 1
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
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
       and role_permission.permission_key = 'roles.delegate'
      join public.organisation_units unit_row
        on unit_row.organisation_id = org_id
       and unit_row.status = 'active'
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
        and grant_row.scope_type = 'unit_subtree'
        and grant_row.scope_unit_id is not null
        and exists (
          select 1
          from public.organisation_unit_closure closure
          where closure.organisation_id = grant_row.organisation_id
            and closure.ancestor_unit_id = grant_row.scope_unit_id
            and closure.descendant_unit_id = unit_row.id
        )
        and private.units_share_site_boundary(
          org_id,
          grant_row.scope_unit_id,
          unit_row.id
        )
    )
    into actor_can_delegate;
  end if;

  if not actor_can_delegate then
    return jsonb_build_object('offers', '[]'::jsonb);
  end if;

  return (
    with actor_grant_permissions as materialized (
      select distinct
        role_permission.permission_key,
        grant_row.scope_type,
        grant_row.scope_unit_id
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
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
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
    ),
    actor_org_grant_keys as (
      select grant_permission.permission_key
      from actor_grant_permissions grant_permission
      where grant_permission.scope_type = 'organisation'
    ),
    actor_org_baseline_keys as (
      select baseline_permission.permission_key
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join private.baseline_participation_permissions baseline_permission
        on baseline_permission.include_in_scoped_permission
       and baseline_permission.scope_mode = 'organisation'
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
        and not private.organisation_requires_site_boundary(org_id)
    ),
    actor_org_keys as materialized (
      select permission_key from actor_org_grant_keys
      union
      select permission_key from actor_org_baseline_keys
    ),
    active_units as materialized (
      select
        unit_row.id,
        unit_row.name,
        unit_row.code,
        private.format_organisation_unit_path_label(unit_row.id) as unit_path
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
    ),
    actor_unit_subtree_keys as (
      select
        unit_row.id as unit_id,
        grant_permission.permission_key
      from actor_grant_permissions grant_permission
      join public.organisation_unit_closure closure
        on closure.organisation_id = org_id
       and closure.ancestor_unit_id = grant_permission.scope_unit_id
      join active_units unit_row
        on unit_row.id = closure.descendant_unit_id
      where grant_permission.scope_type = 'unit_subtree'
        and grant_permission.scope_unit_id is not null
        and private.units_share_site_boundary(
          org_id,
          grant_permission.scope_unit_id,
          unit_row.id
        )
    ),
    actor_unit_baseline_keys as (
      select
        unit_row.id as unit_id,
        baseline_permission.permission_key
      from active_units unit_row
      join public.organisation_memberships actor_membership
        on actor_membership.id = actor_membership_id
       and actor_membership.organisation_id = org_id
       and actor_membership.status = 'active'
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join private.baseline_participation_permissions baseline_permission
        on baseline_permission.include_in_scoped_permission
       and baseline_permission.scope_mode = 'organisation'
      where
        not private.organisation_requires_site_boundary(org_id)
        or private.membership_can_access_unit_site(
          org_id,
          actor_membership_id,
          unit_row.id
        )
    ),
    actor_unit_keys as materialized (
      select unit_row.id as unit_id, org_key.permission_key
      from active_units unit_row
      cross join actor_org_grant_keys org_key
      union
      select unit_subtree.unit_id, unit_subtree.permission_key
      from actor_unit_subtree_keys unit_subtree
      union
      select unit_baseline.unit_id, unit_baseline.permission_key
      from actor_unit_baseline_keys unit_baseline
    ),
    published_roles as materialized (
      select distinct on (role_row.id)
        role_version.id as role_version_id,
        role_row.id as role_id,
        role_row.display_name as role_display_name,
        role_row.canonical_name as role_canonical_name,
        role_row.module_responsibility_key,
        private.role_responsibility_kind(
          role_row.canonical_name,
          role_row.module_responsibility_key,
          role_row.is_owner_role
        ) as responsibility_kind
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = org_id
        and role_version.status = 'published'
        and role_row.status = 'active'
        and (
          not role_row.is_owner_role
          or actor_is_owner
        )
      order by
        role_row.id,
        role_version.version_number desc
    ),
    organisation_scope_options as (
      select
        published_role.role_version_id,
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        ) as scope_option
      from published_roles published_role
      where actor_has_org_delegate
        and private.role_grant_scope_allowed(
          org_id,
          published_role.role_id,
          'organisation'
        )
        and not exists (
          select 1
          from public.role_permissions role_permission
          where role_permission.organisation_id = org_id
            and role_permission.role_version_id = published_role.role_version_id
            and not exists (
              select 1
              from actor_org_keys org_key
              where org_key.permission_key = role_permission.permission_key
            )
        )
    ),
    unit_scope_options as (
      select
        published_role.role_version_id,
        jsonb_build_object(
          'scope_type', 'unit_subtree',
          'scope_unit_id', unit_row.id,
          'label', private.format_delegatable_scope_label(
            org_id,
            unit_row.id,
            unit_row.name
          ),
          'unit_code', unit_row.code,
          'unit_path', unit_row.unit_path
        ) as scope_option,
        unit_row.unit_path
      from published_roles published_role
      join active_units unit_row
        on true
      where private.role_grant_scope_allowed(
          org_id,
          published_role.role_id,
          'unit_subtree'
        )
        and exists (
          select 1
          from actor_unit_keys unit_key
          where unit_key.unit_id = unit_row.id
            and unit_key.permission_key = 'roles.delegate'
        )
        and not exists (
          select 1
          from public.role_permissions role_permission
          where role_permission.organisation_id = org_id
            and role_permission.role_version_id = published_role.role_version_id
            and not exists (
              select 1
              from actor_unit_keys unit_key
              where unit_key.unit_id = unit_row.id
                and unit_key.permission_key = role_permission.permission_key
            )
        )
    ),
    role_scope_options as (
      select
        published_role.role_version_id,
        published_role.role_display_name,
        published_role.role_canonical_name,
        published_role.module_responsibility_key,
        published_role.responsibility_kind,
        coalesce(
          (
            select jsonb_agg(organisation_scope.scope_option)
            from organisation_scope_options organisation_scope
            where organisation_scope.role_version_id = published_role.role_version_id
          ),
          '[]'::jsonb
        )
        || coalesce(
          (
            select jsonb_agg(
              unit_scope.scope_option
              order by unit_scope.unit_path
            )
            from unit_scope_options unit_scope
            where unit_scope.role_version_id = published_role.role_version_id
          ),
          '[]'::jsonb
        ) as scope_options
      from published_roles published_role
    ),
    offers as (
      select jsonb_build_object(
        'role_version_id', role_scope.role_version_id,
        'role_display_name', role_scope.role_display_name,
        'role_canonical_name', role_scope.role_canonical_name,
        'module_responsibility_key', role_scope.module_responsibility_key,
        'responsibility_kind', role_scope.responsibility_kind,
        'scope_options', role_scope.scope_options
      ) as offer_row
      from role_scope_options role_scope
      where jsonb_array_length(role_scope.scope_options) > 0
    )
    select jsonb_build_object(
      'offers',
      coalesce(
        (
          select jsonb_agg(
            offer_row
            order by
              offer_row ->> 'responsibility_kind',
              offer_row ->> 'role_display_name'
          )
          from offers
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.get_delegatable_access_offers() from public, anon;
grant execute on function public.get_delegatable_access_offers() to authenticated;
