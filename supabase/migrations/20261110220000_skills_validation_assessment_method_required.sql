-- Spec A: validation must supply an explicit assessment method (no implicit default).

create or replace function private.record_skill_validation(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_organisational_unit_id uuid default null,
  target_assessment_method text default null,
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

  perform private.assert_current_organisation_module_entitled('skills');

  if target_assessment_method is null
    or target_assessment_method not in (
      'manager_assessment',
      'practical_observation',
      'qualification',
      'trainer_sign_off',
      'external_certification'
    ) then
    raise exception 'skill validation requires a recognised assessment method'
      using errcode = '22023';
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

create or replace function public.record_skill_validation(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_organisational_unit_id uuid default null,
  target_assessment_method text default null,
  target_valid_until timestamptz default null,
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_skill_validation(
  target_membership_id,
  target_skill_id,
  target_proficiency_scale_version_id,
  target_proficiency_level_id,
  target_assessed_at,
  target_organisational_unit_id,
  target_assessment_method,
  target_valid_until,
  target_notes
) $$;

grant execute on function public.record_skill_validation(
  uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text
) to authenticated;

revoke all on function public.record_skill_validation(
  uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text
) from public, anon;

create or replace function private.record_skill_self_assessment(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_assessment_method text default 'self_assessment',
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
  resolved_method text := coalesce(target_assessment_method, 'self_assessment');
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'skill self assessment is not authorised'
      using errcode = '42501';
  end if;

  if target_membership_id <> actor_membership_id then
    raise exception 'self assessment must target own membership'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  if resolved_method <> 'self_assessment' then
    raise exception 'skill self assessment requires the self_assessment method'
      using errcode = '22023';
  end if;

  return private.record_skill_assessment_internal(
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    'self_assessed',
    false,
    target_assessed_at,
    actor_membership_id,
    null,
    resolved_method,
    null,
    target_notes,
    null
  );
end;
$$;

create or replace function public.record_skill_self_assessment(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_assessment_method text default 'self_assessment',
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_skill_self_assessment(
  target_membership_id,
  target_skill_id,
  target_proficiency_scale_version_id,
  target_proficiency_level_id,
  target_assessed_at,
  target_assessment_method,
  target_notes
) $$;
