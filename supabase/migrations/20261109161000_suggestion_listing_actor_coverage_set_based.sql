-- PERF-001 incident follow-up: compute suggestion listing unit coverage in one pass.
-- Org/self scoped flags still use membership_has_scoped_permission (four probes).
-- Unit arrays join grants, closure, and site resolution once per candidate unit.

create or replace function private.suggestion_listing_actor_coverage(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns table (
  has_org_read boolean,
  has_self_read boolean,
  has_org_review boolean,
  has_org_manage boolean,
  readable_unit_ids uuid[],
  reviewable_unit_ids uuid[],
  manageable_unit_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_org_read boolean;
  v_has_self_read boolean;
  v_has_org_review boolean;
  v_has_org_manage boolean;
  v_readable_unit_ids uuid[];
  v_reviewable_unit_ids uuid[];
  v_manageable_unit_ids uuid[];
  v_requires_site boolean;
begin
  if target_organisation_id is null or target_membership_id is null then
    has_org_read := false;
    has_self_read := false;
    has_org_review := false;
    has_org_manage := false;
    readable_unit_ids := '{}'::uuid[];
    reviewable_unit_ids := '{}'::uuid[];
    manageable_unit_ids := '{}'::uuid[];
    return next;
    return;
  end if;

  if not exists (
    select 1
    from public.organisation_memberships actor_membership
    join public.organisations organisation
      on organisation.id = actor_membership.organisation_id
     and organisation.status = 'active'
    join private.identity_controls identity_control
      on identity_control.user_id = actor_membership.user_id
     and identity_control.status = 'active'
     and identity_control.enrolment_status = 'complete'
    where actor_membership.id = target_membership_id
      and actor_membership.organisation_id = target_organisation_id
      and actor_membership.status = 'active'
  ) then
    has_org_read := false;
    has_self_read := false;
    has_org_review := false;
    has_org_manage := false;
    readable_unit_ids := '{}'::uuid[];
    reviewable_unit_ids := '{}'::uuid[];
    manageable_unit_ids := '{}'::uuid[];
    return next;
    return;
  end if;

  v_has_org_read := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.read',
    null,
    null
  );
  v_has_self_read := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.read',
    target_membership_id,
    null
  );
  v_has_org_review := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.review',
    null,
    null
  );
  v_has_org_manage := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.manage',
    null,
    null
  );

  if v_has_org_read and v_has_org_review and v_has_org_manage then
    has_org_read := v_has_org_read;
    has_self_read := v_has_self_read;
    has_org_review := v_has_org_review;
    has_org_manage := v_has_org_manage;
    readable_unit_ids := '{}'::uuid[];
    reviewable_unit_ids := '{}'::uuid[];
    manageable_unit_ids := '{}'::uuid[];
    return next;
    return;
  end if;

  v_requires_site :=
    private.organisation_requires_site_boundary(target_organisation_id);

  with candidate_units as (
    select distinct unit_id
    from (
      select suggestion_row.origin_unit_id as unit_id
      from public.improvement_suggestions suggestion_row
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.origin_unit_id is not null
      union
      select suggestion_row.review_jurisdiction_unit_id as unit_id
      from public.improvement_suggestions suggestion_row
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.review_jurisdiction_unit_id is not null
    ) units
  ),
  unit_sites as (
    select
      candidate_units.unit_id,
      private.resolve_site_unit_id(
        target_organisation_id,
        candidate_units.unit_id
      ) as site_unit_id
    from candidate_units
  ),
  active_grants as (
    select
      grant_row.scope_type,
      grant_row.scope_unit_id,
      role_permission.permission_key
    from public.access_grants grant_row
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
     and role_permission.permission_key in (
       'suggestions.read',
       'suggestions.review',
       'suggestions.manage'
     )
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id = target_membership_id
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
  ),
  grant_unit_access as (
    select distinct
      unit_sites.unit_id,
      active_grants.permission_key
    from active_grants
    join public.organisation_unit_closure closure
      on active_grants.scope_type = 'unit_subtree'
     and closure.organisation_id = target_organisation_id
     and closure.ancestor_unit_id = active_grants.scope_unit_id
    join unit_sites
      on unit_sites.unit_id = closure.descendant_unit_id
    left join lateral (
      select private.resolve_site_unit_id(
        target_organisation_id,
        active_grants.scope_unit_id
      ) as scope_site_unit_id
    ) scope_site on true
    where active_grants.scope_type = 'unit_subtree'
      and (
        not v_requires_site
        or (
          scope_site.scope_site_unit_id is not null
          and scope_site.scope_site_unit_id is not distinct from unit_sites.site_unit_id
        )
      )
  ),
  baseline_unit_access as (
    select distinct
      unit_sites.unit_id,
      baseline_permission.permission_key
    from unit_sites
    cross join private.baseline_participation_permissions baseline_permission
    where baseline_permission.permission_key in (
        'suggestions.read',
        'suggestions.review',
        'suggestions.manage'
      )
      and baseline_permission.include_in_scoped_permission
      and baseline_permission.scope_mode = 'organisation'
      and private.membership_can_access_unit_site(
        target_organisation_id,
        target_membership_id,
        unit_sites.unit_id
      )
  ),
  unit_access as (
    select unit_id, permission_key
    from grant_unit_access
    union
    select unit_id, permission_key
    from baseline_unit_access
  ),
  aggregated as (
    select
      coalesce(
        array_agg(distinct unit_access.unit_id)
          filter (where unit_access.permission_key = 'suggestions.read'),
        '{}'::uuid[]
      ) as readable_units,
      coalesce(
        array_agg(distinct unit_access.unit_id)
          filter (where unit_access.permission_key = 'suggestions.review'),
        '{}'::uuid[]
      ) as reviewable_units,
      coalesce(
        array_agg(distinct unit_access.unit_id)
          filter (where unit_access.permission_key = 'suggestions.manage'),
        '{}'::uuid[]
      ) as manageable_units
    from unit_access
  )
  select
    aggregated.readable_units,
    aggregated.reviewable_units,
    aggregated.manageable_units
  into
    v_readable_unit_ids,
    v_reviewable_unit_ids,
    v_manageable_unit_ids
  from aggregated;

  has_org_read := v_has_org_read;
  has_self_read := v_has_self_read;
  has_org_review := v_has_org_review;
  has_org_manage := v_has_org_manage;

  if v_has_org_read then
    readable_unit_ids := '{}'::uuid[];
  else
    readable_unit_ids := coalesce(v_readable_unit_ids, '{}'::uuid[]);
  end if;

  if v_has_org_review then
    reviewable_unit_ids := '{}'::uuid[];
  else
    reviewable_unit_ids := coalesce(v_reviewable_unit_ids, '{}'::uuid[]);
  end if;

  if v_has_org_manage then
    manageable_unit_ids := '{}'::uuid[];
  else
    manageable_unit_ids := coalesce(v_manageable_unit_ids, '{}'::uuid[]);
  end if;

  return next;
end;
$$;

revoke all on function private.suggestion_listing_actor_coverage(uuid, uuid)
  from public, anon, authenticated;

alter function private.suggestion_listing_actor_coverage(uuid, uuid)
  owner to lean_hub_private_owner;
