-- Deterministic organisation setup readiness. LeanAI consumes this; it does
-- not invent it. CTA wording is static product copy, not model-generated.

create or replace function private.leanai_setup_readiness_cta(
  target_key text,
  target_status text
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when target_key = 'organisation' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Create your organisation', 'target_route', '/create-organisation')
    when target_key = 'organisation' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Complete organisation setup', 'target_route', '/platform/settings/organisation')
    when target_key = 'organisation' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Review organisation profile', 'target_route', '/platform/settings/organisation')
    when target_key = 'organisation' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'sites' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Add your first site', 'target_route', '/platform/settings/structure')
    when target_key = 'sites' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Add an active billable site', 'target_route', '/platform/settings/structure')
    when target_key = 'sites' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Review organisation structure', 'target_route', '/platform/settings/structure')
    when target_key = 'sites' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'people' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Assign an organisation owner', 'target_route', '/platform/settings/people')
    when target_key = 'people' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Configure job functions', 'target_route', '/platform/settings/job-functions')
    when target_key = 'people' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Review people setup', 'target_route', '/platform/settings/people')
    when target_key = 'people' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'maturity' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Set up a Maturity Framework', 'target_route', '/platform/maturity/models')
    when target_key = 'maturity' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Finish and publish your Maturity Framework', 'target_route', '/platform/maturity/models')
    when target_key = 'maturity' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Maturity', 'target_route', '/platform/maturity')
    when target_key = 'maturity' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'suggestions' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Set up a Suggestion Programme', 'target_route', '/platform/suggestions/programmes')
    when target_key = 'suggestions' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Publish your Suggestion Programme', 'target_route', '/platform/suggestions/programmes')
    when target_key = 'suggestions' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Suggestions', 'target_route', '/platform/suggestions')
    when target_key = 'suggestions' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'five_s' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Create a 5S standard', 'target_route', '/platform/5s/standards')
    when target_key = 'five_s' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Publish a 5S standard for an active site', 'target_route', '/platform/5s/standards')
    when target_key = 'five_s' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open 5S', 'target_route', '/platform/5s')
    when target_key = 'five_s' then
      jsonb_build_object('recommended_action', 'Add a site before setting up 5S', 'target_route', '/platform/settings/structure')
    when target_key = 'gemba' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Create a Gemba definition', 'target_route', '/platform/gemba/definitions')
    when target_key = 'gemba' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Publish a Gemba definition for an active site', 'target_route', '/platform/gemba/definitions')
    when target_key = 'gemba' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Gemba', 'target_route', '/platform/gemba')
    when target_key = 'gemba' then
      jsonb_build_object('recommended_action', 'Add a site before setting up Gemba', 'target_route', '/platform/settings/structure')
    when target_key = 'training' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Build your training catalogue', 'target_route', '/platform/training/courses')
    when target_key = 'training' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Publish a course and curriculum requirement', 'target_route', '/platform/training/curriculum')
    when target_key = 'training' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Training', 'target_route', '/platform/training/courses')
    when target_key = 'training' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'skills' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Set up Skills', 'target_route', '/platform/skills')
    when target_key = 'skills' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Publish a skill scale and capability requirements', 'target_route', '/platform/skills')
    when target_key = 'skills' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Skills', 'target_route', '/platform/skills')
    when target_key = 'skills' then
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
    when target_key = 'recognition' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Create a recognition type', 'target_route', '/platform/recognition/types')
    when target_key = 'recognition' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Activate a recognition type', 'target_route', '/platform/recognition/types')
    when target_key = 'recognition' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Open Recognition', 'target_route', '/platform/recognition')
    when target_key = 'recognition' then
      jsonb_build_object('recommended_action', 'Add a site before setting up Recognition', 'target_route', '/platform/settings/structure')
    when target_key = 'lean_ai' and target_status = 'not_started' then
      jsonb_build_object('recommended_action', 'Enable LeanAI for this organisation', 'target_route', '/platform/settings/ai')
    when target_key = 'lean_ai' and target_status = 'incomplete' then
      jsonb_build_object('recommended_action', 'Finish LeanAI availability setup', 'target_route', '/platform/settings/ai')
    when target_key = 'lean_ai' and target_status = 'ready' then
      jsonb_build_object('recommended_action', 'Review LeanAI settings', 'target_route', '/platform/settings/ai')
    else
      jsonb_build_object('recommended_action', 'Restore organisation access', 'target_route', '/billing')
  end;
$$;

create or replace function private.leanai_setup_readiness_item(
  target_key text,
  target_status text,
  target_reason text,
  target_reason_code text,
  target_prerequisites text[],
  target_metrics jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'key', target_key,
    'status', target_status,
    'reason', target_reason,
    'reason_code', target_reason_code,
    'prerequisites', to_jsonb(target_prerequisites),
    'recommended_action', private.leanai_setup_readiness_cta(target_key, target_status) ->> 'recommended_action',
    'target_route', private.leanai_setup_readiness_cta(target_key, target_status) ->> 'target_route',
    'supporting_metrics', coalesce(target_metrics, '{}'::jsonb)
  );
$$;

create or replace function private.evaluate_organisation_setup_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  org_status text;
  org_name text;
  org_onboarding_required boolean;
  org_effective_status text;
  org_operational boolean;
  active_billable_site_count integer;
  active_unit_count integer;
  has_active_owner boolean;
  active_job_function_count integer;
  maturity_model_count integer;
  published_maturity_version_count integer;
  suggestion_programme_count integer;
  active_published_suggestion_programme_count integer;
  five_s_standard_count integer;
  published_applicable_five_s_count integer;
  gemba_definition_count integer;
  published_applicable_gemba_count integer;
  training_course_count integer;
  published_training_course_count integer;
  published_training_curriculum_with_requirement_count integer;
  skill_scale_count integer;
  skill_count integer;
  skill_capability_set_count integer;
  published_skill_scale_with_level_count integer;
  active_skill_count integer;
  published_skill_capability_set_with_requirement_count integer;
  recognition_type_count integer;
  active_recognition_type_count integer;
  lean_ai_enabled boolean;
  lean_ai_current_user_can_use boolean;
  organisation_item jsonb;
  sites_item jsonb;
  people_item jsonb;
  maturity_item jsonb;
  suggestions_item jsonb;
  five_s_item jsonb;
  gemba_item jsonb;
  training_item jsonb;
  skills_item jsonb;
  recognition_item jsonb;
  lean_ai_item jsonb;
  items jsonb;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'organisation setup readiness is not authorised'
      using errcode = '42501';
  end if;

  select
    organisation.status,
    organisation.name,
    organisation.onboarding_required,
    private.effective_organisation_access_status(organisation.status, organisation.id)
  into org_status, org_name, org_onboarding_required, org_effective_status
  from public.organisations organisation
  where organisation.id = org_id;

  org_operational := org_effective_status = 'active';

  active_billable_site_count := private.count_active_billable_sites(org_id);

  select count(*)::integer
  into active_unit_count
  from public.organisation_units unit_row
  where unit_row.organisation_id = org_id
    and unit_row.status = 'active';

  select exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions version_row
      on version_row.organisation_id = grant_row.organisation_id
     and version_row.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = version_row.organisation_id
     and role_row.id = version_row.role_id
    join public.organisation_memberships membership_row
      on membership_row.organisation_id = grant_row.organisation_id
     and membership_row.id = grant_row.grantee_membership_id
    where grant_row.organisation_id = org_id
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and version_row.status = 'published'
      and role_row.is_owner_role
      and role_row.status = 'active'
      and membership_row.status = 'active'
  )
  into has_active_owner;

  select count(*)::integer
  into active_job_function_count
  from public.job_functions job_function_row
  where job_function_row.organisation_id = org_id
    and job_function_row.status = 'active';

  select count(*)::integer
  into maturity_model_count
  from public.maturity_models model_row
  where model_row.organisation_id = org_id;

  select count(*)::integer
  into published_maturity_version_count
  from public.maturity_model_versions version_row
  where version_row.organisation_id = org_id
    and version_row.status = 'published';

  select count(*)::integer
  into suggestion_programme_count
  from public.suggestion_programmes programme_row
  where programme_row.organisation_id = org_id;

  select count(*)::integer
  into active_published_suggestion_programme_count
  from public.suggestion_programmes programme_row
  where programme_row.organisation_id = org_id
    and programme_row.status = 'active'
    and exists (
      select 1
      from public.suggestion_programme_versions version_row
      where version_row.organisation_id = programme_row.organisation_id
        and version_row.programme_id = programme_row.id
        and version_row.lifecycle = 'published'
    );

  select count(*)::integer
  into five_s_standard_count
  from public.five_s_standards standard_row
  where standard_row.organisation_id = org_id;

  select count(*)::integer
  into published_applicable_five_s_count
  from public.five_s_standards standard_row
  where standard_row.organisation_id = org_id
    and exists (
      select 1
      from public.five_s_standard_versions version_row
      where version_row.organisation_id = standard_row.organisation_id
        and version_row.standard_id = standard_row.id
        and version_row.status = 'published'
    )
    and private.five_s_standard_has_active_applicable_unit(org_id, standard_row.id);

  select count(*)::integer
  into gemba_definition_count
  from public.gemba_definitions definition_row
  where definition_row.organisation_id = org_id;

  select count(*)::integer
  into published_applicable_gemba_count
  from public.gemba_definitions definition_row
  where definition_row.organisation_id = org_id
    and exists (
      select 1
      from public.gemba_definition_versions version_row
      where version_row.organisation_id = definition_row.organisation_id
        and version_row.definition_id = definition_row.id
        and version_row.status = 'published'
    )
    and private.gemba_definition_has_active_applicable_unit(org_id, definition_row.id);

  select count(*)::integer
  into training_course_count
  from public.training_courses course_row
  where course_row.organisation_id = org_id;

  select count(*)::integer
  into published_training_course_count
  from public.training_course_versions version_row
  where version_row.organisation_id = org_id
    and version_row.status = 'published';

  select count(*)::integer
  into published_training_curriculum_with_requirement_count
  from public.training_curriculum_versions version_row
  where version_row.organisation_id = org_id
    and version_row.status = 'published'
    and exists (
      select 1
      from public.training_requirements requirement_row
      where requirement_row.organisation_id = version_row.organisation_id
        and requirement_row.curriculum_version_id = version_row.id
    );

  select count(*)::integer
  into skill_scale_count
  from public.skill_proficiency_scales scale_row
  where scale_row.organisation_id = org_id;

  select count(*)::integer
  into skill_count
  from public.skills skill_row
  where skill_row.organisation_id = org_id;

  select count(*)::integer
  into skill_capability_set_count
  from public.skill_capability_sets set_row
  where set_row.organisation_id = org_id;

  select count(*)::integer
  into published_skill_scale_with_level_count
  from public.skill_proficiency_scale_versions version_row
  where version_row.organisation_id = org_id
    and version_row.status = 'published'
    and exists (
      select 1
      from public.skill_proficiency_levels level_row
      where level_row.organisation_id = version_row.organisation_id
        and level_row.scale_version_id = version_row.id
    );

  select count(*)::integer
  into active_skill_count
  from public.skills skill_row
  where skill_row.organisation_id = org_id
    and skill_row.status = 'active';

  select count(*)::integer
  into published_skill_capability_set_with_requirement_count
  from public.skill_capability_set_versions version_row
  where version_row.organisation_id = org_id
    and version_row.status = 'published'
    and exists (
      select 1
      from public.skill_requirements requirement_row
      where requirement_row.organisation_id = version_row.organisation_id
        and requirement_row.capability_set_version_id = version_row.id
    );

  select count(*)::integer
  into recognition_type_count
  from public.recognition_types type_row
  where type_row.organisation_id = org_id;

  select count(*)::integer
  into active_recognition_type_count
  from public.recognition_types type_row
  where type_row.organisation_id = org_id
    and type_row.status = 'active';

  select coalesce(settings_row.ai_enabled, false)
  into lean_ai_enabled
  from public.organisation_ai_settings settings_row
  where settings_row.organisation_id = org_id;

  lean_ai_enabled := coalesce(lean_ai_enabled, false);
  lean_ai_current_user_can_use :=
    private.has_scoped_permission(org_id, 'ai.use', null, null)
    or private.has_scoped_permission(
      org_id,
      'ai.use',
      null,
      private.membership_primary_organisational_unit_id(org_id, actor_membership_id)
    );

  if not org_operational then
    organisation_item := private.leanai_setup_readiness_item(
      'organisation', 'blocked', 'Organisation access is suspended or closed.',
      'organisation_not_operational', array[]::text[],
      jsonb_build_object('organisation_status', org_effective_status, 'onboarding_required', org_onboarding_required)
    );
  elsif org_name is null or btrim(org_name) = '' then
    organisation_item := private.leanai_setup_readiness_item(
      'organisation', 'not_started', 'Organisation profile has not been created.',
      'organisation_missing', array[]::text[],
      jsonb_build_object('organisation_status', org_status)
    );
  elsif org_status <> 'active' or org_onboarding_required then
    organisation_item := private.leanai_setup_readiness_item(
      'organisation', 'incomplete', 'Organisation profile or onboarding is still incomplete.',
      'organisation_onboarding_incomplete', array[]::text[],
      jsonb_build_object('organisation_status', org_status, 'onboarding_required', org_onboarding_required)
    );
  else
    organisation_item := private.leanai_setup_readiness_item(
      'organisation', 'ready', 'Organisation profile is active.',
      'organisation_active', array[]::text[],
      jsonb_build_object('organisation_status', org_status, 'onboarding_required', org_onboarding_required)
    );
  end if;

  if active_billable_site_count >= 1 then
    sites_item := private.leanai_setup_readiness_item(
      'sites', 'ready', 'At least one active site exists.', 'sites_ready',
      array['organisation']::text[],
      jsonb_build_object('active_billable_site_count', active_billable_site_count, 'active_unit_count', active_unit_count)
    );
  elsif active_unit_count >= 1 then
    sites_item := private.leanai_setup_readiness_item(
      'sites', 'incomplete', 'Units exist but none are active billable sites.', 'sites_no_billable_site',
      array['organisation']::text[],
      jsonb_build_object('active_billable_site_count', active_billable_site_count, 'active_unit_count', active_unit_count)
    );
  else
    sites_item := private.leanai_setup_readiness_item(
      'sites', 'not_started', 'No active site has been created.', 'sites_none',
      array['organisation']::text[],
      jsonb_build_object('active_billable_site_count', active_billable_site_count, 'active_unit_count', active_unit_count)
    );
  end if;

  if not has_active_owner then
    people_item := private.leanai_setup_readiness_item(
      'people', 'not_started', 'No active organisation owner is assigned.', 'people_no_owner',
      array['organisation']::text[],
      jsonb_build_object('has_active_owner', has_active_owner, 'active_job_function_count', active_job_function_count)
    );
  elsif active_job_function_count < 1 then
    people_item := private.leanai_setup_readiness_item(
      'people', 'incomplete', 'An owner exists, but job functions have not been configured.',
      'people_no_job_functions', array['organisation']::text[],
      jsonb_build_object('has_active_owner', has_active_owner, 'active_job_function_count', active_job_function_count)
    );
  else
    people_item := private.leanai_setup_readiness_item(
      'people', 'ready', 'An organisation owner and at least one job function exist.',
      'people_ready', array['organisation']::text[],
      jsonb_build_object('has_active_owner', has_active_owner, 'active_job_function_count', active_job_function_count)
    );
  end if;

  if published_maturity_version_count >= 1 then
    maturity_item := private.leanai_setup_readiness_item(
      'maturity', 'ready', 'A published Maturity Framework exists.', 'maturity_published',
      array['organisation', 'sites']::text[],
      jsonb_build_object('model_count', maturity_model_count, 'published_version_count', published_maturity_version_count)
    );
  elsif maturity_model_count >= 1 then
    maturity_item := private.leanai_setup_readiness_item(
      'maturity', 'incomplete', 'A Maturity Framework exists but is not published.', 'maturity_draft_only',
      array['organisation', 'sites']::text[],
      jsonb_build_object('model_count', maturity_model_count, 'published_version_count', published_maturity_version_count)
    );
  else
    maturity_item := private.leanai_setup_readiness_item(
      'maturity', 'not_started', 'No Maturity Framework exists yet.', 'maturity_none',
      array['organisation', 'sites']::text[],
      jsonb_build_object('model_count', maturity_model_count, 'published_version_count', published_maturity_version_count)
    );
  end if;

  if active_published_suggestion_programme_count >= 1 then
    suggestions_item := private.leanai_setup_readiness_item(
      'suggestions', 'ready', 'An active published Suggestion Programme exists.', 'suggestions_published',
      array['organisation', 'sites']::text[],
      jsonb_build_object('programme_count', suggestion_programme_count, 'active_published_programme_count', active_published_suggestion_programme_count)
    );
  elsif suggestion_programme_count >= 1 then
    suggestions_item := private.leanai_setup_readiness_item(
      'suggestions', 'incomplete', 'A Suggestion Programme exists but is not active and published.',
      'suggestions_unpublished', array['organisation', 'sites']::text[],
      jsonb_build_object('programme_count', suggestion_programme_count, 'active_published_programme_count', active_published_suggestion_programme_count)
    );
  else
    suggestions_item := private.leanai_setup_readiness_item(
      'suggestions', 'not_started', 'No Suggestion Programme exists yet.', 'suggestions_none',
      array['organisation', 'sites']::text[],
      jsonb_build_object('programme_count', suggestion_programme_count, 'active_published_programme_count', active_published_suggestion_programme_count)
    );
  end if;

  if published_applicable_five_s_count >= 1 then
    five_s_item := private.leanai_setup_readiness_item(
      'five_s', 'ready', 'A published 5S standard applies to an active unit.', 'five_s_published',
      array['sites', 'organisation']::text[],
      jsonb_build_object('standard_count', five_s_standard_count, 'published_applicable_count', published_applicable_five_s_count)
    );
  elsif five_s_standard_count >= 1 then
    five_s_item := private.leanai_setup_readiness_item(
      'five_s', 'incomplete', 'A 5S standard exists but is not published with active applicability.',
      'five_s_unpublished', array['sites', 'organisation']::text[],
      jsonb_build_object('standard_count', five_s_standard_count, 'published_applicable_count', published_applicable_five_s_count)
    );
  else
    five_s_item := private.leanai_setup_readiness_item(
      'five_s', 'not_started', 'No 5S standard exists yet.', 'five_s_none',
      array['sites', 'organisation']::text[],
      jsonb_build_object('standard_count', five_s_standard_count, 'published_applicable_count', published_applicable_five_s_count)
    );
  end if;

  if published_applicable_gemba_count >= 1 then
    gemba_item := private.leanai_setup_readiness_item(
      'gemba', 'ready', 'A published Gemba definition applies to an active unit.', 'gemba_published',
      array['sites', 'organisation']::text[],
      jsonb_build_object('definition_count', gemba_definition_count, 'published_applicable_count', published_applicable_gemba_count)
    );
  elsif gemba_definition_count >= 1 then
    gemba_item := private.leanai_setup_readiness_item(
      'gemba', 'incomplete', 'A Gemba definition exists but is not published with active applicability.',
      'gemba_unpublished', array['sites', 'organisation']::text[],
      jsonb_build_object('definition_count', gemba_definition_count, 'published_applicable_count', published_applicable_gemba_count)
    );
  else
    gemba_item := private.leanai_setup_readiness_item(
      'gemba', 'not_started', 'No Gemba definition exists yet.', 'gemba_none',
      array['sites', 'organisation']::text[],
      jsonb_build_object('definition_count', gemba_definition_count, 'published_applicable_count', published_applicable_gemba_count)
    );
  end if;

  if published_training_course_count >= 1 and published_training_curriculum_with_requirement_count >= 1 then
    training_item := private.leanai_setup_readiness_item(
      'training', 'ready', 'A published course and a published curriculum requirement exist.',
      'training_ready', array['organisation', 'people']::text[],
      jsonb_build_object(
        'course_count', training_course_count,
        'published_course_count', published_training_course_count,
        'published_curriculum_with_requirement_count', published_training_curriculum_with_requirement_count
      )
    );
  elsif training_course_count >= 1 or published_training_course_count >= 1 then
    training_item := private.leanai_setup_readiness_item(
      'training', 'incomplete', 'Training catalogue work has started, but a published curriculum requirement is missing.',
      'training_catalogue_only', array['organisation', 'people']::text[],
      jsonb_build_object(
        'course_count', training_course_count,
        'published_course_count', published_training_course_count,
        'published_curriculum_with_requirement_count', published_training_curriculum_with_requirement_count
      )
    );
  else
    training_item := private.leanai_setup_readiness_item(
      'training', 'not_started', 'No training catalogue exists yet.', 'training_none',
      array['organisation', 'people']::text[],
      jsonb_build_object(
        'course_count', training_course_count,
        'published_course_count', published_training_course_count,
        'published_curriculum_with_requirement_count', published_training_curriculum_with_requirement_count
      )
    );
  end if;

  if published_skill_scale_with_level_count >= 1
    and active_skill_count >= 1
    and published_skill_capability_set_with_requirement_count >= 1 then
    skills_item := private.leanai_setup_readiness_item(
      'skills', 'ready', 'A published scale, an active skill, and a published capability requirement exist.',
      'skills_ready', array['organisation', 'people']::text[],
      jsonb_build_object(
        'scale_count', skill_scale_count,
        'skill_count', skill_count,
        'capability_set_count', skill_capability_set_count,
        'published_scale_with_level_count', published_skill_scale_with_level_count,
        'active_skill_count', active_skill_count,
        'published_capability_set_with_requirement_count', published_skill_capability_set_with_requirement_count
      )
    );
  elsif skill_scale_count >= 1 or skill_count >= 1 or skill_capability_set_count >= 1 then
    skills_item := private.leanai_setup_readiness_item(
      'skills', 'incomplete', 'Skills configuration has started but is not yet a usable published set.',
      'skills_partial', array['organisation', 'people']::text[],
      jsonb_build_object(
        'scale_count', skill_scale_count,
        'skill_count', skill_count,
        'capability_set_count', skill_capability_set_count,
        'published_scale_with_level_count', published_skill_scale_with_level_count,
        'active_skill_count', active_skill_count,
        'published_capability_set_with_requirement_count', published_skill_capability_set_with_requirement_count
      )
    );
  else
    skills_item := private.leanai_setup_readiness_item(
      'skills', 'not_started', 'No Skills configuration exists yet.', 'skills_none',
      array['organisation', 'people']::text[],
      jsonb_build_object(
        'scale_count', skill_scale_count,
        'skill_count', skill_count,
        'capability_set_count', skill_capability_set_count,
        'published_scale_with_level_count', published_skill_scale_with_level_count,
        'active_skill_count', active_skill_count,
        'published_capability_set_with_requirement_count', published_skill_capability_set_with_requirement_count
      )
    );
  end if;

  if active_recognition_type_count >= 1 then
    recognition_item := private.leanai_setup_readiness_item(
      'recognition', 'ready', 'At least one active recognition type exists.', 'recognition_ready',
      array['sites', 'organisation']::text[],
      jsonb_build_object('type_count', recognition_type_count, 'active_type_count', active_recognition_type_count)
    );
  elsif recognition_type_count >= 1 then
    recognition_item := private.leanai_setup_readiness_item(
      'recognition', 'incomplete', 'Recognition types exist but none are active.', 'recognition_inactive',
      array['sites', 'organisation']::text[],
      jsonb_build_object('type_count', recognition_type_count, 'active_type_count', active_recognition_type_count)
    );
  else
    recognition_item := private.leanai_setup_readiness_item(
      'recognition', 'not_started', 'No recognition type exists yet.', 'recognition_none',
      array['sites', 'organisation']::text[],
      jsonb_build_object('type_count', recognition_type_count, 'active_type_count', active_recognition_type_count)
    );
  end if;

  if not lean_ai_enabled then
    lean_ai_item := private.leanai_setup_readiness_item(
      'lean_ai', 'not_started', 'LeanAI is not enabled for this organisation.', 'lean_ai_disabled',
      array['organisation']::text[],
      jsonb_build_object('organisation_enabled', lean_ai_enabled, 'current_user_can_use', lean_ai_current_user_can_use)
    );
  elsif not lean_ai_current_user_can_use then
    lean_ai_item := private.leanai_setup_readiness_item(
      'lean_ai', 'incomplete', 'LeanAI is enabled, but the current user cannot use it.',
      'lean_ai_no_permission', array['organisation']::text[],
      jsonb_build_object('organisation_enabled', lean_ai_enabled, 'current_user_can_use', lean_ai_current_user_can_use)
    );
  else
    lean_ai_item := private.leanai_setup_readiness_item(
      'lean_ai', 'ready', 'LeanAI is enabled for this organisation and the current user may use it.',
      'lean_ai_org_ready', array['organisation']::text[],
      jsonb_build_object('organisation_enabled', lean_ai_enabled, 'current_user_can_use', lean_ai_current_user_can_use)
    );
  end if;

  if sites_item ->> 'status' = 'not_started' and organisation_item ->> 'status' <> 'ready' then
    sites_item := private.leanai_setup_readiness_item(
      'sites', 'blocked', 'This capability is waiting on organisation setup.', 'blocked_by_organisation',
      array['organisation']::text[], sites_item -> 'supporting_metrics'
    );
  end if;

  if people_item ->> 'status' = 'not_started' and organisation_item ->> 'status' <> 'ready' then
    people_item := private.leanai_setup_readiness_item(
      'people', 'blocked', 'This capability is waiting on organisation setup.', 'blocked_by_organisation',
      array['organisation']::text[], people_item -> 'supporting_metrics'
    );
  end if;

  if five_s_item ->> 'status' = 'not_started' and sites_item ->> 'status' <> 'ready' then
    five_s_item := private.leanai_setup_readiness_item(
      'five_s', 'blocked', 'This capability is waiting on sites setup.', 'blocked_by_sites',
      array['sites', 'organisation']::text[], five_s_item -> 'supporting_metrics'
    );
  end if;

  if gemba_item ->> 'status' = 'not_started' and sites_item ->> 'status' <> 'ready' then
    gemba_item := private.leanai_setup_readiness_item(
      'gemba', 'blocked', 'This capability is waiting on sites setup.', 'blocked_by_sites',
      array['sites', 'organisation']::text[], gemba_item -> 'supporting_metrics'
    );
  end if;

  if recognition_item ->> 'status' = 'not_started' and sites_item ->> 'status' <> 'ready' then
    recognition_item := private.leanai_setup_readiness_item(
      'recognition', 'blocked', 'This capability is waiting on sites setup.', 'blocked_by_sites',
      array['sites', 'organisation']::text[], recognition_item -> 'supporting_metrics'
    );
  end if;

  if lean_ai_item ->> 'status' = 'not_started' and organisation_item ->> 'status' <> 'ready' then
    lean_ai_item := private.leanai_setup_readiness_item(
      'lean_ai', 'blocked', 'This capability is waiting on organisation setup.', 'blocked_by_organisation',
      array['organisation']::text[], lean_ai_item -> 'supporting_metrics'
    );
  end if;

  items := jsonb_build_array(
    organisation_item,
    sites_item,
    people_item,
    maturity_item,
    suggestions_item,
    five_s_item,
    gemba_item,
    training_item,
    skills_item,
    recognition_item,
    lean_ai_item
  );

  return jsonb_build_object(
    'organisation_id', org_id,
    'evaluated_at', statement_timestamp(),
    'ready_count', (
      select count(*)
      from jsonb_array_elements(items) item_row
      where item_row ->> 'status' = 'ready'
    ),
    'total_count', 11,
    'items', items
  );
end;
$$;

create or replace function private.get_leanai_contextual_snapshot()
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
    raise exception 'leanai contextual snapshot is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'readiness', private.evaluate_organisation_setup_readiness(),
    'journey', private.get_leanai_journey_context(),
    'retention', jsonb_build_object(
      'event_retention_days', private.leanai_event_retention_days(org_id),
      'cleanup_available', true
    )
  );
end;
$$;

create or replace function public.record_leanai_semantic_event(
  target_event_key text,
  target_event_version integer default 1,
  target_module_key text default null,
  target_intervention_key text default null,
  target_site_unit_id uuid default null,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_leanai_semantic_event(
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    target_site_unit_id,
    target_metadata,
    target_occurred_at
  )
$$;

create or replace function public.get_leanai_journey_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_leanai_journey_context()
$$;

create or replace function public.get_organisation_setup_readiness()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.evaluate_organisation_setup_readiness()
$$;

create or replace function public.get_leanai_contextual_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_leanai_contextual_snapshot()
$$;

grant execute on function public.record_leanai_semantic_event(text, integer, text, text, uuid, jsonb, timestamptz)
  to authenticated;
grant execute on function public.get_leanai_journey_context() to authenticated;
grant execute on function public.get_organisation_setup_readiness() to authenticated;
grant execute on function public.get_leanai_contextual_snapshot() to authenticated;

revoke all on function public.record_leanai_semantic_event(text, integer, text, text, uuid, jsonb, timestamptz)
  from public, anon;
revoke all on function public.get_leanai_journey_context() from public, anon;
revoke all on function public.get_organisation_setup_readiness() from public, anon;
revoke all on function public.get_leanai_contextual_snapshot() from public, anon;

revoke all on function private.cleanup_expired_leanai_semantic_events(uuid) from public, anon, authenticated;
grant execute on function private.cleanup_expired_leanai_semantic_events(uuid) to lean_hub_private_owner;

alter function private.leanai_validate_semantic_event_payload(text, integer, text, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.leanai_upsert_journey_from_event(uuid, uuid, text, text, text, jsonb, timestamptz)
  owner to lean_hub_private_owner;
alter function private.record_leanai_semantic_event(text, integer, text, text, uuid, jsonb, timestamptz)
  owner to lean_hub_private_owner;
alter function private.leanai_event_retention_days(uuid) owner to lean_hub_private_owner;
alter function private.cleanup_expired_leanai_semantic_events(uuid) owner to lean_hub_private_owner;
alter function private.get_leanai_journey_context() owner to lean_hub_private_owner;
alter function private.leanai_setup_readiness_cta(text, text) owner to lean_hub_private_owner;
alter function private.leanai_setup_readiness_item(text, text, text, text, text[], jsonb)
  owner to lean_hub_private_owner;
alter function private.evaluate_organisation_setup_readiness() owner to lean_hub_private_owner;
alter function private.get_leanai_contextual_snapshot() owner to lean_hub_private_owner;
