-- Unit-scoped roles (e.g. plant manager) must pass review/approve/publish checks
-- against the assessed organisational unit, not only organisation-wide scope.

create or replace function private.begin_assessor_review(
  target_assessment_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  current_status text;
  assessment_unit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'assessor review is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status, assessment_row.unit_id
  into current_status, assessment_unit_id
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'formal'
    and assessment_row.status = 'submitted'
  for update;

  if not found then
    raise exception 'maturity assessment is not reviewable'
      using errcode = '55000';
  end if;

  if not private.has_scoped_permission(org_id, 'maturity.review', null, assessment_unit_id) then
    raise exception 'assessor review is not authorised'
      using errcode = '42501';
  end if;

  update public.maturity_assessments
  set status = 'assessor_review',
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'assessor_review',
    actor_membership_id
  );

  return true;
end;
$$;

create or replace function private.approve_maturity_assessment(
  target_assessment_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  current_status text;
  assessment_unit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'maturity assessment approval is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status, assessment_row.unit_id
  into current_status, assessment_unit_id
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'formal'
    and assessment_row.status = 'assessor_review'
  for update;

  if not found then
    raise exception 'maturity assessment is not approvable'
      using errcode = '55000';
  end if;

  if not private.has_scoped_permission(org_id, 'maturity.approve', null, assessment_unit_id) then
    raise exception 'maturity assessment approval is not authorised'
      using errcode = '42501';
  end if;

  perform private.calculate_maturity_assessment_scores(target_assessment_id);

  update public.maturity_assessments
  set status = 'approved',
      approved_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'approved',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.approved',
    target_assessment_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_assessment_id,
    'AssessmentApproved',
    target_assessment_id::text,
    jsonb_build_object('assessment_id', target_assessment_id)
  );

  return true;
end;
$$;

create or replace function private.publish_official_maturity_result(
  target_assessment_id uuid
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
  current_status text;
  target_model_version_id uuid;
  target_submission_id uuid;
  target_unit_id uuid;
  overall_score numeric;
  official_result_id uuid;
  pillar_row record;
  level_row record;
  model_name text;
  model_version_number integer;
  unit_name text;
  unit_code text;
  assessment_type text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'official maturity result publication is not authorised'
      using errcode = '42501';
  end if;

  select
    assessment_row.status,
    assessment_row.model_version_id,
    assessment_row.submission_id,
    assessment_row.unit_id,
    assessment_row.assessment_type
  into current_status, target_model_version_id, target_submission_id, target_unit_id, assessment_type
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'formal'
    and assessment_row.status = 'approved'
  for update;

  if not found then
    raise exception 'maturity assessment is not publishable'
      using errcode = '55000';
  end if;

  if not private.has_scoped_permission(org_id, 'maturity.results.publish', null, target_unit_id) then
    raise exception 'official maturity result publication is not authorised'
      using errcode = '42501';
  end if;

  select score_row.score
  into overall_score
  from public.maturity_assessment_scores score_row
  where score_row.organisation_id = org_id
    and score_row.assessment_id = target_assessment_id
    and score_row.score_level = 'overall';

  if overall_score is null then
    raise exception 'maturity assessment has no overall score'
      using errcode = '55000';
  end if;

  select maturity_model.display_name, model_version.version_number
  into model_name, model_version_number
  from public.maturity_model_versions model_version
  join public.maturity_models maturity_model
    on maturity_model.organisation_id = model_version.organisation_id
   and maturity_model.id = model_version.model_id
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id;

  select organisation_unit.name, organisation_unit.code
  into unit_name, unit_code
  from public.organisation_units organisation_unit
  where organisation_unit.organisation_id = org_id
    and organisation_unit.id = target_unit_id;

  insert into public.maturity_official_results (
    organisation_id,
    assessment_id,
    model_version_id,
    overall_score,
    published_by_membership_id,
    published_at,
    model_name_snapshot,
    model_version_number_snapshot,
    unit_id_snapshot,
    unit_name_snapshot,
    unit_code_snapshot,
    assessment_type_snapshot
  )
  values (
    org_id,
    target_assessment_id,
    target_model_version_id,
    overall_score,
    actor_membership_id,
    statement_timestamp(),
    model_name,
    model_version_number,
    target_unit_id,
    unit_name,
    unit_code,
    assessment_type
  )
  returning id into official_result_id;

  for level_row in
    select
      level_item.level_number,
      level_item.name,
      level_item.description,
      level_item.color_token,
      level_item.guidance
    from public.maturity_levels level_item
    where level_item.organisation_id = org_id
      and level_item.model_version_id = target_model_version_id
    order by level_item.level_number
  loop
    insert into public.maturity_official_result_levels (
      organisation_id,
      official_result_id,
      level_number,
      name,
      description,
      color_token,
      guidance
    )
    values (
      org_id,
      official_result_id,
      level_row.level_number,
      level_row.name,
      level_row.description,
      level_row.color_token,
      level_row.guidance
    );
  end loop;

  for pillar_row in
    select
      pillar_item.id as pillar_id,
      pillar_item.name as pillar_name,
      pillar_item.position as pillar_position,
      score_item.score
    from public.maturity_pillars pillar_item
    join public.maturity_assessment_scores score_item
      on score_item.organisation_id = pillar_item.organisation_id
     and score_item.assessment_id = target_assessment_id
     and score_item.score_level = 'pillar'
     and score_item.entity_id = pillar_item.id
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = target_model_version_id
    order by pillar_item.position
  loop
    insert into public.maturity_official_result_pillars (
      organisation_id,
      official_result_id,
      pillar_id,
      pillar_name,
      pillar_position,
      score
    )
    values (
      org_id,
      official_result_id,
      pillar_row.pillar_id,
      pillar_row.pillar_name,
      pillar_row.pillar_position,
      pillar_row.score
    );
  end loop;

  update public.maturity_assessments
  set status = 'published',
      published_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  update public.template_submissions submission_row
  set status = 'completed',
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where submission_row.organisation_id = org_id
    and submission_row.id = target_submission_id
    and submission_row.status = 'draft';

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'published',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.result.published',
    target_assessment_id,
    'succeeded',
    jsonb_build_object(
      'assessment_id', target_assessment_id,
      'official_result_id', official_result_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_assessment_id,
    'OfficialMaturityResultPublished',
    official_result_id::text,
    jsonb_build_object(
      'assessment_id', target_assessment_id,
      'official_result_id', official_result_id
    )
  );

  return official_result_id;
end;
$$;
