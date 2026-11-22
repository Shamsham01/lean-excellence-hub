-- PEOPLE-ACCESS-002: employee-visible self profile.
--
-- Active members can read their own capability header, training profile and
-- skills profile without people.capability.read, memberships.read, roles.read
-- or people-directory access. Administration profiles stay gated. Self access
-- does not grant self-assessment, skill validation, or action-creation rights.
-- Effective grants exclude expired, revoked, unpublished and inactive roles.

create or replace function private.is_current_active_membership(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_membership_id(target_organisation_id) is not null
    and target_membership_id =
      private.current_membership_id(target_organisation_id)
$$;

alter function private.is_current_active_membership(uuid, uuid)
  owner to lean_hub_private_owner;
revoke all on function private.is_current_active_membership(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.get_membership_capability_profile_header(
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
begin
  if org_id is null
    or not exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    )
    or not coalesce(
      private.can_read_membership_capability_profile(org_id, target_membership_id)
      or private.is_current_active_membership(org_id, target_membership_id),
      false
    ) then
    raise exception 'membership capability profile header is not authorised'
      using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'membership_id', membership_row.id,
      'display_name',
        coalesce(membership_row.display_name, profile_row.display_name),
      'job_title', membership_row.job_title,
      'job_function_name', assignment_row.job_function_name_snapshot,
      'organisational_unit_id', assignment_row.organisational_unit_id
    )
    from public.organisation_memberships membership_row
    left join public.profiles profile_row
      on profile_row.user_id = membership_row.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_row.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    where membership_row.organisation_id = org_id
      and membership_row.id = target_membership_id
      and membership_row.status = 'active'
  );
end;
$$;

create or replace function public.get_membership_training_profile(
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
  published_curriculum_version_id uuid;
begin
  if org_id is null
    or not exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    )
    or not coalesce(
      private.can_read_membership_capability_profile(org_id, target_membership_id)
      or private.is_current_active_membership(org_id, target_membership_id),
      false
    ) then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  published_curriculum_version_id :=
    private.get_published_training_curriculum_version_id(org_id);

  return jsonb_build_object(
    'requirements',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'requirement_id', requirement_row.id,
              'course_id', requirement_row.course_id,
              'course_name', course_row.name,
              'mandatory', requirement_row.mandatory,
              'is_satisfied',
                private.membership_has_valid_training_completion(
                  org_id,
                  target_membership_id,
                  requirement_row.course_id
                )
            )
          )
          from public.training_requirements requirement_row
          join public.training_courses course_row
            on course_row.organisation_id = requirement_row.organisation_id
           and course_row.id = requirement_row.course_id
          left join public.membership_job_function_assignments assignment_row
            on assignment_row.organisation_id = org_id
           and assignment_row.membership_id = target_membership_id
           and assignment_row.is_primary = true
           and assignment_row.valid_from <= statement_timestamp()
           and (
             assignment_row.valid_to is null
             or assignment_row.valid_to > statement_timestamp()
           )
          where requirement_row.organisation_id = org_id
            and requirement_row.curriculum_version_id =
              published_curriculum_version_id
            and (
              requirement_row.applies_to_all_members
              or (
                requirement_row.job_function_id is not null
                and assignment_row.job_function_id = requirement_row.job_function_id
              )
            )
        ),
        '[]'::jsonb
      ),
    'completions',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'completion_id', completion_row.id,
              'course_id', completion_row.course_id,
              'course_version_id', completion_row.course_version_id,
              'completed_at', completion_row.completed_at,
              'status', completion_row.status,
              'validity_state',
                private.derive_training_completion_validity_state(
                  completion_row.status,
                  completion_row.expires_at
                ),
              'expires_at', completion_row.expires_at
            )
            order by completion_row.completed_at desc
          )
          from public.training_completions completion_row
          where completion_row.organisation_id = org_id
            and completion_row.membership_id = target_membership_id
        ),
        '[]'::jsonb
      )
  );
end;
$$;

create or replace function public.get_membership_skills_profile(
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
begin
  if org_id is null
    or not exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    )
    or not coalesce(
      private.can_read_membership_capability_profile(org_id, target_membership_id)
      or private.is_current_active_membership(org_id, target_membership_id),
      false
    ) then
    raise exception 'membership skills profile is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'gaps',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'skill_id', skill_row.id,
              'skill_name', skill_row.name,
              'gap', private.derive_skill_gap(target_membership_id, skill_row.id)
            )
          )
          from public.skills skill_row
          where skill_row.organisation_id = org_id
            and skill_row.status = 'active'
        ),
        '[]'::jsonb
      ),
    'assessments',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'assessment_id', assessment_row.id,
              'skill_id', assessment_row.skill_id,
              'assertion_type', assessment_row.assertion_type,
              'is_authoritative', assessment_row.is_authoritative,
              'proficiency_level_id', assessment_row.proficiency_level_id,
              'proficiency_scale_version_id', assessment_row.proficiency_scale_version_id,
              'assessed_at', assessment_row.assessed_at,
              'assessment_method', assessment_row.assessment_method,
              'valid_until', assessment_row.valid_until
            )
            order by assessment_row.assessed_at desc
          )
          from public.membership_skill_assessments assessment_row
          where assessment_row.organisation_id = org_id
            and assessment_row.membership_id = target_membership_id
        ),
        '[]'::jsonb
      )
  );
end;
$$;

create or replace function public.get_own_membership_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'own membership profile is not authorised'
      using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'membership_id', membership_row.id,
      'organisation_display_name', membership_row.display_name,
      'personal_display_name', profile_row.display_name,
      'job_function',
        case
          when assignment_row.job_function_id is null then null
          else jsonb_build_object(
            'name', assignment_row.job_function_name_snapshot,
            'code', assignment_row.job_function_code_snapshot
          )
        end,
      'primary_organisational_unit',
        case
          when unit_row.id is null then null
          else jsonb_build_object(
            'id', unit_row.id,
            'name', unit_row.name,
            'code', unit_row.code
          )
        end,
      'access_grants', coalesce(grants_json.grants, '[]'::jsonb)
    )
    from public.organisation_memberships membership_row
    left join public.profiles profile_row
      on profile_row.user_id = membership_row.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_row.id
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
          'role_canonical_name', role_row.canonical_name,
          'scope_type', grant_row.scope_type,
          'scope_unit_id', grant_row.scope_unit_id,
          'scope_unit_name', scope_unit.name,
          'scope_unit_path',
            case
              when grant_row.scope_unit_id is null then null
              else private.format_organisation_unit_path_label(grant_row.scope_unit_id)
            end
        )
        order by role_row.display_name, grant_row.scope_type
      ) as grants
      from public.access_grants grant_row
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      left join public.organisation_units scope_unit
        on scope_unit.organisation_id = grant_row.organisation_id
       and scope_unit.id = grant_row.scope_unit_id
      where grant_row.organisation_id = org_id
        and grant_row.grantee_membership_id = actor_membership_id
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and (
          grant_row.expires_at is null
          or grant_row.expires_at > statement_timestamp()
        )
    ) grants_json on true
    where membership_row.organisation_id = org_id
      and membership_row.id = actor_membership_id
      and membership_row.status = 'active'
  );
end;
$$;

revoke all on function public.get_own_membership_profile() from public, anon;
grant execute on function public.get_own_membership_profile() to authenticated;
