-- Harden profile and resource reads: no catalog-wide bypass of membership scope.

create or replace function private.can_read_training_completion(
  target_organisation_id uuid,
  target_completion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.training_completions completion_row
    where completion_row.organisation_id = target_organisation_id
      and completion_row.id = target_completion_id
      and private.can_read_membership_capability_profile(
        target_organisation_id,
        completion_row.membership_id
      )
  )
$$;

create or replace function private.can_read_skill_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = target_assessment_id
      and private.can_read_membership_capability_profile(
        target_organisation_id,
        assessment_row.membership_id
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

  if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
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

  if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
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

  if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
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

create or replace function private.create_capability_action(
  target_title text,
  target_gap_type text,
  target_membership_id uuid,
  target_course_id uuid default null,
  target_skill_id uuid default null,
  target_training_completion_id uuid default null,
  target_skill_assessment_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
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
  unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'actions.create', null, null) then
    raise exception 'capability action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_gap_type = 'training_gap' then
    if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  elsif target_gap_type in ('skill_gap', 'skill_assessment_follow_up') then
    if not private.can_assess_skills(org_id, target_membership_id, null)
      and not private.can_read_membership_capability_profile(org_id, target_membership_id) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  else
    raise exception 'invalid capability gap type'
      using errcode = '22023';
  end if;

  select assignment_row.organisational_unit_id
  into unit_id
  from public.membership_job_function_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.membership_id = target_membership_id
    and assignment_row.is_primary = true
    and assignment_row.valid_from <= statement_timestamp()
    and (
      assignment_row.valid_to is null
      or assignment_row.valid_to > statement_timestamp()
    )
  limit 1;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    null,
    target_due_at,
    null
  );

  insert into public.capability_action_context (
    organisation_id,
    action_id,
    gap_type,
    membership_id,
    course_id,
    skill_id,
    training_completion_id,
    skill_assessment_id,
    notes,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_gap_type,
    target_membership_id,
    target_course_id,
    target_skill_id,
    target_training_completion_id,
    target_skill_assessment_id,
    target_notes,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

alter function private.can_read_training_completion(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_skill_assessment(uuid, uuid) owner to lean_hub_private_owner;
