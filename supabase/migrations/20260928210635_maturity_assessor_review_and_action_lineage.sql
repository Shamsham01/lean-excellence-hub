-- Formal assessor review workspace, return-for-correction, lead-assessor
-- validation, answer/comment audit, and assessment-action context guards.

create or replace function private.can_edit_maturity_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assessment_row public.maturity_assessments%rowtype;
  permission_key text;
  actor_membership_id uuid := private.current_membership_id(target_organisation_id);
begin
  select assessment_item.*
  into assessment_row
  from public.maturity_assessments assessment_item
  where assessment_item.organisation_id = target_organisation_id
    and assessment_item.id = target_assessment_id;

  if not found then
    return false;
  end if;

  if assessment_row.status = 'assessor_review' then
    return private.has_scoped_permission(
      target_organisation_id,
      'maturity.review',
      null,
      assessment_row.unit_id
    );
  end if;

  if assessment_row.status not in ('draft', 'in_progress') then
    return false;
  end if;

  permission_key := case assessment_row.assessment_type
    when 'self' then 'maturity.assess.self'
    else 'maturity.assess.formal'
  end;

  return private.has_scoped_permission(
    target_organisation_id,
    permission_key,
    null,
    assessment_row.unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    permission_key,
    assessment_row.created_by_membership_id,
    null
  )
  or (
    actor_membership_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      permission_key,
      actor_membership_id,
      null
    )
  )
  or (
    assessment_row.lead_assessor_membership_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      permission_key,
      assessment_row.lead_assessor_membership_id,
      null
    )
  );
end;
$$;

create or replace function private.start_maturity_assessment(
  target_model_version_id uuid,
  target_unit_id uuid,
  target_assessment_type text,
  target_assessment_scope_type text,
  target_lead_assessor_membership_id uuid default null
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
  permission_key text;
  template_version_id uuid;
  new_assessment_id uuid;
  new_submission_id uuid;
  resolved_lead_assessor_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'maturity assessment start is not authorised'
      using errcode = '42501';
  end if;

  if target_assessment_type not in ('self', 'formal') then
    raise exception 'invalid assessment type'
      using errcode = '22023';
  end if;

  if target_assessment_scope_type not in ('site', 'department', 'area') then
    raise exception 'invalid assessment scope type'
      using errcode = '22023';
  end if;

  permission_key := case target_assessment_type
    when 'self' then 'maturity.assess.self'
    else 'maturity.assess.formal'
  end;

  if not private.has_scoped_permission(org_id, permission_key, null, target_unit_id)
    and not private.has_scoped_permission(org_id, permission_key, actor_membership_id, null) then
    raise exception 'maturity assessment start is not authorised'
      using errcode = '42501';
  end if;

  resolved_lead_assessor_id := target_lead_assessor_membership_id;
  if target_assessment_type = 'self' then
    resolved_lead_assessor_id := null;
  elsif resolved_lead_assessor_id is null then
    raise exception 'formal assessment requires a lead assessor'
      using errcode = '22023';
  else
    if not exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = resolved_lead_assessor_id
        and membership_row.status = 'active'
    ) then
      raise exception 'lead assessor is not valid in this organisation'
        using errcode = '22023';
    end if;
  end if;

  select model_version.template_version_id
  into template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'published';

  if template_version_id is null then
    raise exception 'maturity model version is not published'
      using errcode = '55000';
  end if;

  if not private.maturity_model_version_allows_scope(
    org_id,
    target_model_version_id,
    target_assessment_scope_type
  ) then
    raise exception 'assessment scope type is not enabled for framework version'
      using errcode = '55000';
  end if;

  if not private.organisation_unit_matches_semantic_scope(
    org_id,
    target_unit_id,
    target_assessment_scope_type
  ) then
    raise exception 'selected unit does not match requested assessment scope type'
      using errcode = '55000';
  end if;

  new_assessment_id := private.register_resource_record(
    org_id,
    'maturity_assessment',
    gen_random_uuid(),
    actor_membership_id
  );

  new_submission_id := private.register_resource_record(
    org_id,
    'template_submission',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.template_submissions (
    id,
    organisation_id,
    template_version_id,
    created_by_membership_id
  )
  values (
    new_submission_id,
    org_id,
    template_version_id,
    actor_membership_id
  );

  insert into public.maturity_assessments (
    id,
    organisation_id,
    assessment_type,
    status,
    unit_id,
    model_version_id,
    submission_id,
    assessment_scope_type,
    lead_assessor_membership_id,
    created_by_membership_id,
    started_at
  )
  values (
    new_assessment_id,
    org_id,
    target_assessment_type,
    'in_progress',
    target_unit_id,
    target_model_version_id,
    new_submission_id,
    target_assessment_scope_type,
    resolved_lead_assessor_id,
    actor_membership_id,
    statement_timestamp()
  );

  perform private.append_maturity_assessment_transition(
    org_id,
    new_assessment_id,
    'draft',
    'in_progress',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.started',
    new_assessment_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'assessment_type', target_assessment_type,
      'assessment_scope_type', target_assessment_scope_type,
      'lead_assessor_membership_id', resolved_lead_assessor_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_assessment_id,
    'AssessmentStarted',
    new_assessment_id::text,
    pg_catalog.jsonb_build_object('assessment_id', new_assessment_id)
  );

  return new_assessment_id;
end;
$$;

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

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.review_started',
    target_assessment_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.return_maturity_assessment_for_correction(
  target_assessment_id uuid,
  target_reason text
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
  reason_text text := btrim(coalesce(target_reason, ''));
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'return for correction is not authorised'
      using errcode = '42501';
  end if;

  if reason_text = '' then
    raise exception 'return for correction requires a reason'
      using errcode = '22023';
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
    raise exception 'maturity assessment cannot be returned for correction'
      using errcode = '55000';
  end if;

  if not private.has_scoped_permission(org_id, 'maturity.review', null, assessment_unit_id) then
    raise exception 'return for correction is not authorised'
      using errcode = '42501';
  end if;

  update public.maturity_assessments
  set status = 'in_progress',
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'in_progress',
    actor_membership_id,
    reason_text
  );

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.returned_for_correction',
    target_assessment_id,
    'succeeded',
    pg_catalog.jsonb_build_object('reason', reason_text)
  );

  return true;
end;
$$;

create or replace function private.upsert_maturity_assessment_answer(
  target_assessment_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
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
  target_submission_id uuid;
  answer_id uuid;
  previous_number numeric;
  previous_text text;
  previous_na boolean;
  assessment_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment answer upsert is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.submission_id, assessment_row.status
  into target_submission_id, assessment_status
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_model_versions model_version
      on model_version.organisation_id = assessment_row.organisation_id
     and model_version.id = assessment_row.model_version_id
    join public.template_questions question_row
      on question_row.organisation_id = model_version.organisation_id
     and question_row.id = target_question_id
     and question_row.template_version_id = model_version.template_version_id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'question does not belong to assessment model version'
      using errcode = '23503';
  end if;

  select
    answer_row.number_value,
    answer_row.text_value,
    answer_row.is_not_applicable
  into previous_number, previous_text, previous_na
  from public.template_answers answer_row
  where answer_row.organisation_id = org_id
    and answer_row.submission_id = target_submission_id
    and answer_row.question_id = target_question_id;

  insert into public.template_answers (
    organisation_id,
    submission_id,
    question_id,
    is_not_applicable,
    text_value,
    number_value,
    date_value,
    json_value,
    updated_at
  )
  values (
    org_id,
    target_submission_id,
    target_question_id,
    target_is_not_applicable,
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value,
    statement_timestamp()
  )
  on conflict (organisation_id, submission_id, question_id)
  do update
  set is_not_applicable = excluded.is_not_applicable,
      text_value = excluded.text_value,
      number_value = excluded.number_value,
      date_value = excluded.date_value,
      json_value = excluded.json_value,
      updated_at = statement_timestamp()
  returning id into answer_id;

  if previous_number is distinct from target_number_value
    or previous_text is distinct from target_text_value
    or coalesce(previous_na, false) is distinct from coalesce(target_is_not_applicable, false) then
    perform private.append_business_audit(
      org_id,
      'maturity.assessment.answer_changed',
      target_assessment_id,
      'succeeded',
      pg_catalog.jsonb_build_object(
        'question_id', target_question_id,
        'previous_number_value', previous_number,
        'new_number_value', target_number_value,
        'previous_text_value', previous_text,
        'new_text_value', target_text_value,
        'assessment_status', assessment_status,
        'actor_membership_id', actor_membership_id
      )
    );
  end if;

  return answer_id;
end;
$$;

create or replace function private.upsert_maturity_assessment_criterion_note(
  target_assessment_id uuid,
  target_criterion_id uuid,
  target_comment_text text
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
  note_id uuid;
  previous_comment text;
  assessment_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment note upsert is not authorised'
      using errcode = '42501';
  end if;

  if btrim(coalesce(target_comment_text, '')) = '' then
    raise exception 'assessor comment cannot be empty'
      using errcode = '22023';
  end if;

  select assessment_row.status
  into assessment_status
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_model_versions model_version
      on model_version.organisation_id = assessment_row.organisation_id
     and model_version.id = assessment_row.model_version_id
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = assessment_row.organisation_id
     and criterion_row.id = target_criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = model_version.id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'criterion does not belong to assessment framework version'
      using errcode = '23503';
  end if;

  select note_row.comment_text
  into previous_comment
  from public.maturity_assessment_criterion_notes note_row
  where note_row.organisation_id = org_id
    and note_row.assessment_id = target_assessment_id
    and note_row.criterion_id = target_criterion_id;

  insert into public.maturity_assessment_criterion_notes (
    organisation_id,
    assessment_id,
    criterion_id,
    comment_text,
    created_by_membership_id
  )
  values (
    org_id,
    target_assessment_id,
    target_criterion_id,
    btrim(target_comment_text),
    actor_membership_id
  )
  on conflict (organisation_id, assessment_id, criterion_id)
  do update
  set comment_text = excluded.comment_text,
      updated_at = statement_timestamp()
  returning id into note_id;

  if previous_comment is distinct from btrim(target_comment_text) then
    perform private.append_business_audit(
      org_id,
      'maturity.assessment.comment_changed',
      target_assessment_id,
      'succeeded',
      pg_catalog.jsonb_build_object(
        'criterion_id', target_criterion_id,
        'previous_comment_text', previous_comment,
        'new_comment_text', btrim(target_comment_text),
        'assessment_status', assessment_status,
        'actor_membership_id', actor_membership_id
      )
    );
  end if;

  return note_id;
end;
$$;

create or replace function private.create_maturity_action(
  target_title text,
  target_assessment_id uuid,
  target_pillar_id uuid,
  target_criterion_id uuid,
  target_question_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
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
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity action creation is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.unit_id
  into unit_id
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = assessment_row.organisation_id
     and pillar_row.id = target_pillar_id
     and pillar_row.model_version_id = assessment_row.model_version_id
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = pillar_row.organisation_id
     and criterion_row.id = target_criterion_id
     and criterion_row.pillar_id = pillar_row.id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'maturity action context is invalid'
      using errcode = '23503';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.maturity_criterion_questions question_link
      where question_link.organisation_id = org_id
        and question_link.criterion_id = target_criterion_id
        and question_link.question_id = target_question_id
    ) then
    raise exception 'maturity action question does not belong to criterion'
      using errcode = '23503';
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_assessment_id,
    target_due_at,
    null
  );

  insert into public.maturity_action_context (
    organisation_id,
    action_id,
    assessment_id,
    pillar_id,
    criterion_id,
    question_id,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_assessment_id,
    target_pillar_id,
    target_criterion_id,
    target_question_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

create or replace function public.return_maturity_assessment_for_correction(
  target_assessment_id uuid,
  target_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.return_maturity_assessment_for_correction(
    target_assessment_id,
    target_reason
  )
$$;

grant execute on function public.return_maturity_assessment_for_correction(uuid, text) to authenticated;
revoke all on function public.return_maturity_assessment_for_correction(uuid, text) from public, anon;

alter function private.can_edit_maturity_assessment(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.start_maturity_assessment(uuid, uuid, text, text, uuid)
  owner to lean_hub_private_owner;
alter function private.begin_assessor_review(uuid)
  owner to lean_hub_private_owner;
alter function private.return_maturity_assessment_for_correction(uuid, text)
  owner to lean_hub_private_owner;
alter function private.upsert_maturity_assessment_answer(uuid, uuid, boolean, text, numeric, date, jsonb)
  owner to lean_hub_private_owner;
alter function private.upsert_maturity_assessment_criterion_note(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.create_maturity_action(text, uuid, uuid, uuid, uuid, text, text, timestamptz)
  owner to lean_hub_private_owner;
