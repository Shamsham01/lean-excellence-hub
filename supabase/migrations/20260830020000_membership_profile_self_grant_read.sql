-- Allow members to read their own active access grants on the profile RPC
-- without granting roles.read or other administration permissions.

create or replace function public.get_membership_administration_profile(
  target_membership_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  resolved_membership public.organisation_memberships%rowtype;
  profile_email text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into resolved_membership
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'memberships.read', null, null)
    or (
      target_membership_id = actor_membership_id
      and private.can_read_membership_capability_profile(org_id, target_membership_id)
    )
  ) then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select auth_user.email
  into profile_email
  from auth.users auth_user
  where auth_user.id = resolved_membership.user_id
    and private.has_scoped_permission(org_id, 'memberships.read', null, null);

  return (
    select jsonb_build_object(
      'membership_id', membership_registry.id,
      'display_name',
        coalesce(membership_registry.display_name, profile_row.display_name),
      'email', profile_email,
      'status', membership_registry.status,
      'job_title', membership_registry.job_title,
      'primary_organisational_unit',
        case
          when assignment_row.organisational_unit_id is null then null
          else jsonb_build_object(
            'id', unit_row.id,
            'name', unit_row.name,
            'code', unit_row.code
          )
        end,
      'job_function',
        case
          when assignment_row.job_function_id is null then null
          else jsonb_build_object(
            'id', assignment_row.job_function_id,
            'name', assignment_row.job_function_name_snapshot,
            'code', assignment_row.job_function_code_snapshot
          )
        end,
      'access_grants', coalesce(grants_json.grants, '[]'::jsonb),
      'permissions', jsonb_build_object(
        'can_manage_membership',
          private.has_scoped_permission(org_id, 'memberships.manage', null, null),
        'can_manage_job_functions',
          private.can_manage_job_functions(org_id)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'job_functions.manage',
                null,
                scoped_unit.id
              )
          ),
        'can_delegate_access',
          private.has_scoped_permission(org_id, 'roles.delegate', null, null)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'roles.delegate',
                null,
                scoped_unit.id
              )
          ),
        'is_self', target_membership_id = actor_membership_id
      )
    )
    from public.organisation_memberships membership_registry
    left join public.profiles profile_row
      on profile_row.user_id = membership_registry.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_registry.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    left join public.organisation_units unit_row
      on unit_row.organisation_id = org_id
     and unit_row.id = assignment_row.organisational_unit_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'grant_id', grant_row.id,
          'role_display_name', role_row.display_name,
          'scope_type', grant_row.scope_type,
          'scope_unit_name', scope_unit.name,
          'status', grant_row.status
        )
        order by role_row.display_name
      ) as grants
      from public.access_grants grant_row
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      left join public.organisation_units scope_unit
        on scope_unit.organisation_id = grant_row.organisation_id
       and scope_unit.id = grant_row.scope_unit_id
      where grant_row.organisation_id = org_id
        and grant_row.grantee_membership_id = membership_registry.id
        and grant_row.status = 'active'
        and (
          private.has_scoped_permission(org_id, 'roles.read', null, null)
          or (
            target_membership_id = actor_membership_id
            and grant_row.grantee_membership_id = actor_membership_id
          )
        )
    ) grants_json on true
    where membership_registry.organisation_id = org_id
      and membership_registry.id = target_membership_id
  );
end;
$$;
