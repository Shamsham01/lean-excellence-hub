-- Scoped capability access: unit-subtree grants, profile reads, and gap derivation.

create or replace function private.membership_primary_organisational_unit_id(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assignment_row.organisational_unit_id
  from public.membership_job_function_assignments assignment_row
  where assignment_row.organisation_id = target_organisation_id
    and assignment_row.membership_id = target_membership_id
    and assignment_row.is_primary = true
    and assignment_row.valid_from <= statement_timestamp()
    and (
      assignment_row.valid_to is null
      or assignment_row.valid_to > statement_timestamp()
    )
  limit 1
$$;

create or replace function private.can_read_membership_capability_profile(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
      target_membership_id,
      null
    )
    or (
      private.membership_primary_organisational_unit_id(
        target_organisation_id,
        target_membership_id
      ) is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'people.capability.read',
        null,
        private.membership_primary_organisational_unit_id(
          target_organisation_id,
          target_membership_id
        )
      )
    )
$$;

create or replace function private.can_read_people_directory(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
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
       and role_permission.permission_key = 'people.capability.read'
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

create or replace function private.can_read_training_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'training.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'training.read',
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
       and role_permission.permission_key = 'training.read'
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

create or replace function private.can_read_skills_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'skills.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'skills.read',
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
       and role_permission.permission_key = 'skills.read'
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

create or replace function private.can_assess_skills(
  target_organisation_id uuid,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'skills.assess',
      null,
      null
    )
    or (
      target_membership_id is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'skills.assess',
        target_membership_id,
        null
      )
    )
    or (
      target_unit_id is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'skills.assess',
        null,
        target_unit_id
      )
    )
    or (
      target_membership_id is not null
      and private.membership_primary_organisational_unit_id(
        target_organisation_id,
        target_membership_id
      ) is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'skills.assess',
        null,
        private.membership_primary_organisational_unit_id(
          target_organisation_id,
          target_membership_id
        )
      )
    )
$$;

create or replace function private.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  capability_version_id uuid;
  requirement_row public.skill_requirements%rowtype;
  current_assessment public.membership_skill_assessments%rowtype;
  current_order integer;
  target_order integer;
begin
  if org_id is null then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_membership_capability_profile(org_id, target_membership_id)
    and not private.can_read_skills_catalog(org_id) then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if target_capability_set_version_id is not null then
    capability_version_id := target_capability_set_version_id;
  else
    select version_row.id
    into capability_version_id
    from public.skill_capability_set_versions version_row
    join public.skill_capability_sets set_row
      on set_row.organisation_id = version_row.organisation_id
     and set_row.id = version_row.capability_set_id
    where version_row.organisation_id = org_id
      and version_row.status = 'published'
      and set_row.status = 'active'
    order by version_row.published_at desc nulls last
    limit 1;
  end if;

  if capability_version_id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  select requirement_registry.*
  into requirement_row
  from public.skill_requirements requirement_registry
  left join public.membership_job_function_assignments assignment_row
    on assignment_row.organisation_id = org_id
   and assignment_row.membership_id = target_membership_id
   and assignment_row.is_primary = true
   and assignment_row.valid_from <= statement_timestamp()
   and (
     assignment_row.valid_to is null
     or assignment_row.valid_to > statement_timestamp()
   )
  where requirement_registry.organisation_id = org_id
    and requirement_registry.capability_set_version_id = capability_version_id
    and requirement_registry.skill_id = target_skill_id
    and requirement_registry.job_function_id = assignment_row.job_function_id
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_required');
  end if;

  current_assessment := private.get_current_authoritative_skill_assessment(
    org_id,
    target_membership_id,
    target_skill_id
  );

  select level_row.order_value
  into target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = requirement_row.target_proficiency_level_id;

  if current_assessment.id is null then
    return jsonb_build_object(
      'status', 'not_assessed',
      'target_order', target_order,
      'target_scale_version_id', requirement_row.proficiency_scale_version_id
    );
  end if;

  if current_assessment.proficiency_scale_version_id
    <> requirement_row.proficiency_scale_version_id then
    return jsonb_build_object(
      'status', 'incompatible_scale',
      'target_scale_version_id', requirement_row.proficiency_scale_version_id,
      'assessment_scale_version_id', current_assessment.proficiency_scale_version_id
    );
  end if;

  select level_row.order_value
  into current_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = current_assessment.proficiency_level_id;

  return jsonb_build_object(
    'status',
      case
        when current_order < target_order then 'below_requirement'
        when current_order = target_order then 'meets_requirement'
        else 'above_requirement'
      end,
    'current_order', current_order,
    'target_order', target_order,
    'gap', greatest(target_order - current_order, 0),
    'scale_version_id', requirement_row.proficiency_scale_version_id,
    'current_assessment_id', current_assessment.id
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
  curriculum_version_id uuid;
begin
  if org_id is null then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_membership_capability_profile(org_id, target_membership_id)
    and not private.can_read_training_catalog(org_id) then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  curriculum_version_id := private.get_published_training_curriculum_version_id(org_id);

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
            and requirement_row.curriculum_version_id = curriculum_version_id
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
  if org_id is null then
    raise exception 'membership skills profile is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_membership_capability_profile(org_id, target_membership_id)
    and not private.can_read_skills_catalog(org_id) then
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

create or replace function public.get_people_directory(
  target_search text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_value integer;
begin
  if org_id is null
    or not private.can_read_people_directory(org_id) then
    raise exception 'people directory is not authorised'
      using errcode = '42501';
  end if;

  offset_value := greatest(target_page - 1, 0) * target_page_size;

  return jsonb_build_object(
    'people',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', membership_row.id,
              'display_name', coalesce(membership_row.display_name, profile_row.display_name),
              'job_title', membership_row.job_title,
              'job_function_name', assignment_row.job_function_name_snapshot,
              'job_function_code', assignment_row.job_function_code_snapshot
            )
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
            and membership_row.status = 'active'
            and private.can_read_membership_capability_profile(org_id, membership_row.id)
            and (
              target_search is null
              or coalesce(membership_row.display_name, profile_row.display_name, '')
                ilike '%' || btrim(target_search) || '%'
            )
          order by coalesce(membership_row.display_name, profile_row.display_name)
          limit target_page_size offset offset_value
        ),
        '[]'::jsonb
      ),
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;

create or replace function private.record_skill_validation(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_organisational_unit_id uuid default null,
  target_assessment_method text default 'manager_assessment',
  target_valid_until timestamptz default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  resolved_unit_id uuid := target_organisational_unit_id;
begin
  if resolved_unit_id is null then
    resolved_unit_id := private.membership_primary_organisational_unit_id(
      org_id,
      target_membership_id
    );
  end if;

  if org_id is null
    or actor_membership_id is null
    or not private.can_assess_skills(
      org_id,
      target_membership_id,
      resolved_unit_id
    ) then
    raise exception 'skill validation is not authorised'
      using errcode = '42501';
  end if;

  return private.record_skill_assessment_internal(
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    'validated',
    true,
    target_assessed_at,
    actor_membership_id,
    resolved_unit_id,
    target_assessment_method,
    target_valid_until,
    target_notes,
    null
  );
end;
$$;

alter function private.membership_primary_organisational_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_read_membership_capability_profile(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_read_people_directory(uuid)
  owner to lean_hub_private_owner;
