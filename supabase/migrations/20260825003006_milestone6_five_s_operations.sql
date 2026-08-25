-- 5S authoritative operations, scoring, and RLS policies.

create or replace function private.can_read_five_s_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'five_s.read',
    null,
    null
  )
$$;

create or replace function private.can_read_five_s_audit(
  target_organisation_id uuid,
  target_audit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.five_s_audits audit_row
    where audit_row.organisation_id = target_organisation_id
      and audit_row.id = target_audit_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'five_s.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'five_s.read',
          null,
          audit_row.unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'five_s.read',
          audit_row.auditor_membership_id,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'five_s.audit.review',
          null,
          audit_row.unit_id
        )
      )
  )
$$;

create or replace function private.can_edit_five_s_audit(
  target_organisation_id uuid,
  target_audit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.five_s_audits audit_row
    where audit_row.organisation_id = target_organisation_id
      and audit_row.id = target_audit_id
      and audit_row.status in ('draft', 'in_progress')
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'five_s.audit.perform',
          null,
          audit_row.unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'five_s.audit.perform',
          audit_row.auditor_membership_id,
          null
        )
      )
  )
$$;

create or replace function private.derive_five_s_result_status(
  target_score_percent numeric,
  target_mappings jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  mapping_key text;
  mapping_value jsonb;
  min_value numeric;
  max_value numeric;
begin
  for mapping_key, mapping_value in
    select key_item.key, key_item.value
    from jsonb_each(target_mappings) as key_item(key, value)
  loop
    min_value := (mapping_value ->> 'min')::numeric;
    max_value := (mapping_value ->> 'max')::numeric;
    if target_score_percent >= min_value and target_score_percent <= max_value then
      return mapping_key;
    end if;
  end loop;

  return 'unknown';
end;
$$;

create or replace function private.create_five_s_standard_draft(
  target_display_name text,
  target_description text default null,
  target_threshold_percent numeric default 90
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
  new_standard_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
  new_standard_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard creation is not authorised'
      using errcode = '42501';
  end if;

  new_standard_id := private.register_resource_record(
    org_id,
    'five_s_standard',
    gen_random_uuid(),
    actor_membership_id
  );

  new_template_id := private.register_resource_record(
    org_id,
    'template',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.templates (
    id, organisation_id, experience_type, display_name, description, created_by_membership_id
  )
  values (
    new_template_id, org_id, 'five_s_audit', target_display_name, target_description, actor_membership_id
  );

  insert into public.five_s_standards (
    id, organisation_id, template_id, display_name, description, created_by_membership_id
  )
  values (
    new_standard_id, org_id, new_template_id, target_display_name, target_description, actor_membership_id
  );

  insert into public.template_versions (
    organisation_id, template_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_template_id, 1, 'draft', actor_membership_id)
  returning id into new_template_version_id;

  insert into public.five_s_standard_versions (
    organisation_id, standard_id, template_version_id, version_number, status,
    target_threshold_percent, created_by_membership_id
  )
  values (
    org_id, new_standard_id, new_template_version_id, 1, 'draft',
    target_threshold_percent, actor_membership_id
  )
  returning id into new_standard_version_id;

  perform private.append_business_audit(
    org_id, 'five_s.standard.created', new_standard_id, 'succeeded',
    jsonb_build_object('template_id', new_template_id)
  );

  return new_standard_id;
end;
$$;

create or replace function private.add_five_s_section(
  target_standard_version_id uuid,
  target_title text,
  target_position integer
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
  template_version_id uuid;
  new_section_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S section creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.template_version_id
  into template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft';

  if template_version_id is null then
    raise exception '5S standard version is not editable'
      using errcode = '55000';
  end if;

  new_section_id := private.add_template_section_internal(
    template_version_id,
    target_title,
    target_position
  );

  insert into public.five_s_section_weights (
    organisation_id, standard_version_id, section_id, weight
  )
  values (org_id, target_standard_version_id, new_section_id, 1)
  on conflict (organisation_id, standard_version_id, section_id) do nothing;

  return new_section_id;
end;
$$;

create or replace function private.add_five_s_question(
  target_standard_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null,
  target_contributes_to_score boolean default false,
  target_scoring_metadata jsonb default null,
  target_weight numeric default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  template_version_id uuid;
  new_question_id uuid;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S question creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.template_version_id
  into template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft';

  if template_version_id is null then
    raise exception '5S standard version is not editable'
      using errcode = '55000';
  end if;

  new_question_id := private.add_template_question_internal(
    template_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    target_position,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  );

  insert into public.five_s_question_scoring (
    organisation_id,
    standard_version_id,
    question_id,
    contributes_to_score,
    scoring_metadata,
    weight
  )
  values (
    org_id,
    target_standard_version_id,
    new_question_id,
    target_contributes_to_score,
    target_scoring_metadata,
    target_weight
  );

  return new_question_id;
end;
$$;

create or replace function private.set_five_s_section_weight(
  target_standard_version_id uuid,
  target_section_id uuid,
  target_weight numeric
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S section weight update is not authorised'
      using errcode = '42501';
  end if;

  update public.five_s_section_weights weight_row
  set weight = target_weight
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = target_standard_version_id
    and weight_row.section_id = target_section_id;

  if not found then
    raise exception '5S section weight was not found'
      using errcode = '23503';
  end if;

  return true;
end;
$$;

create or replace function private.publish_five_s_standard_version(
  target_standard_version_id uuid
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
  template_version_id uuid;
  standard_id uuid;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard publication is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.template_version_id,
    standard_version.standard_id
  into template_version_id, standard_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if not found then
    raise exception '5S standard version is not publishable'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_scoring.scoring_metadata,
      question_row.question_type
    from public.five_s_question_scoring question_scoring
    join public.template_questions question_row
      on question_row.organisation_id = question_scoring.organisation_id
     and question_row.id = question_scoring.question_id
    where question_scoring.organisation_id = org_id
      and question_scoring.standard_version_id = target_standard_version_id
      and question_scoring.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  update public.five_s_standard_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_standard_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id, 'five_s.standard.published', standard_id, 'succeeded',
    jsonb_build_object('standard_version_id', target_standard_version_id)
  );

  return true;
end;
$$;

create or replace function private.calculate_five_s_audit_scores(
  target_audit_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  target_standard_version_id uuid;
  target_submission_id uuid;
  weighting_enabled boolean;
  section_row record;
  question_row record;
  question_scores numeric[] := array[]::numeric[];
  question_weights numeric[] := array[]::numeric[];
  section_scores numeric[] := array[]::numeric[];
  section_weights numeric[] := array[]::numeric[];
  question_score numeric;
  section_score numeric;
  overall_score numeric;
begin
  select
    audit_row.standard_version_id,
    audit_row.submission_id,
    standard_version.weighting_enabled
  into target_standard_version_id, target_submission_id, weighting_enabled
  from public.five_s_audits audit_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = audit_row.organisation_id
   and standard_version.id = audit_row.standard_version_id
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id;

  if target_standard_version_id is null then
    raise exception '5S audit was not found'
      using errcode = '23503';
  end if;

  section_scores := array[]::numeric[];
  section_weights := array[]::numeric[];

  for section_row in
    select section_item.id, coalesce(weight_row.weight, 1) as weight
    from public.template_sections section_item
    join public.five_s_standard_versions standard_version
      on standard_version.organisation_id = section_item.organisation_id
     and standard_version.template_version_id = section_item.template_version_id
    left join public.five_s_section_weights weight_row
      on weight_row.organisation_id = section_item.organisation_id
     and weight_row.standard_version_id = standard_version.id
     and weight_row.section_id = section_item.id
    where section_item.organisation_id = org_id
      and standard_version.id = target_standard_version_id
    order by section_item.position
  loop
    question_scores := array[]::numeric[];
    question_weights := array[]::numeric[];

    for question_row in
      select
        question_scoring.weight,
        question_scoring.scoring_metadata,
        question_item.question_type,
        answer_item.is_not_applicable,
        answer_item.text_value,
        answer_item.number_value,
        answer_item.json_value
      from public.five_s_question_scoring question_scoring
      join public.template_questions question_item
        on question_item.organisation_id = question_scoring.organisation_id
       and question_item.id = question_scoring.question_id
       and question_item.section_id = section_row.id
      left join public.template_answers answer_item
        on answer_item.organisation_id = question_scoring.organisation_id
       and answer_item.submission_id = target_submission_id
       and answer_item.question_id = question_scoring.question_id
      where question_scoring.organisation_id = org_id
        and question_scoring.standard_version_id = target_standard_version_id
        and question_scoring.contributes_to_score = true
    loop
      question_score := private.extract_scored_answer_value(
        question_row.question_type,
        question_row.scoring_metadata,
        coalesce(question_row.is_not_applicable, false),
        question_row.text_value,
        question_row.number_value,
        question_row.json_value
      );

      if question_score is not null then
        question_scores := array_append(question_scores, question_score);
        question_weights := array_append(question_weights, question_row.weight);
      end if;
    end loop;

    section_score := private.weighted_average(
      question_scores,
      question_weights,
      weighting_enabled
    );

    if section_score is not null then
      section_scores := array_append(section_scores, section_score);
      section_weights := array_append(section_weights, section_row.weight);
    end if;
  end loop;

  overall_score := private.weighted_average(
    section_scores,
    section_weights,
    weighting_enabled
  );

  update public.five_s_audits
  set overall_score_percent = round(overall_score, 2)
  where organisation_id = org_id
    and id = target_audit_id;

  return true;
end;
$$;

create or replace function private.start_five_s_audit(
  target_standard_id uuid,
  target_unit_id uuid,
  target_schedule_occurrence_id uuid default null
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
  standard_version_id uuid;
  template_version_id uuid;
  new_audit_id uuid;
  new_submission_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception '5S audit start is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(org_id, 'five_s.audit.perform', null, target_unit_id)
    and not private.has_scoped_permission(org_id, 'five_s.audit.perform', actor_membership_id, null) then
    raise exception '5S audit start is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.id, standard_version.template_version_id
  into standard_version_id, template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.standard_id = target_standard_id
    and standard_version.status = 'published'
  order by standard_version.version_number desc
  limit 1;

  if standard_version_id is null then
    raise exception '5S standard has no published version'
      using errcode = '55000';
  end if;

  if target_schedule_occurrence_id is not null then
    if not exists (
      select 1
      from public.schedule_occurrences occurrence_row
      join public.schedule_definitions schedule_row
        on schedule_row.organisation_id = occurrence_row.organisation_id
       and schedule_row.id = occurrence_row.schedule_definition_id
      where occurrence_row.organisation_id = org_id
        and occurrence_row.id = target_schedule_occurrence_id
        and occurrence_row.lifecycle_status = 'open'
        and schedule_row.activity_resource_id = target_standard_id
    ) then
      raise exception 'schedule occurrence is not valid for this 5S standard'
        using errcode = '55000';
    end if;
  end if;

  new_audit_id := private.register_resource_record(
    org_id, 'five_s_audit', gen_random_uuid(), actor_membership_id
  );

  new_submission_id := private.register_resource_record(
    org_id, 'template_submission', gen_random_uuid(), actor_membership_id
  );

  insert into public.template_submissions (
    id, organisation_id, template_version_id, created_by_membership_id
  )
  values (new_submission_id, org_id, template_version_id, actor_membership_id);

  insert into public.five_s_audits (
    id, organisation_id, standard_version_id, unit_id, submission_id,
    schedule_occurrence_id, auditor_membership_id, status, started_at, created_by_membership_id
  )
  values (
    new_audit_id, org_id, standard_version_id, target_unit_id, new_submission_id,
    target_schedule_occurrence_id, actor_membership_id, 'in_progress', statement_timestamp(), actor_membership_id
  );

  perform private.append_business_audit(
    org_id, 'five_s.audit.started', new_audit_id, 'succeeded', jsonb_build_object('standard_id', target_standard_id)
  );

  perform private.enqueue_domain_event(
    org_id, new_audit_id, 'FiveSAuditStarted', new_audit_id::text,
    jsonb_build_object('audit_id', new_audit_id)
  );

  return new_audit_id;
end;
$$;

create or replace function private.upsert_five_s_audit_answer(
  target_audit_id uuid,
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
  target_submission_id uuid;
begin
  if not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S audit answer upsert is not authorised'
      using errcode = '42501';
  end if;

  select audit_row.submission_id
  into target_submission_id
  from public.five_s_audits audit_row
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id;

  if not exists (
    select 1
    from public.five_s_audits audit_row
    join public.five_s_standard_versions standard_version
      on standard_version.organisation_id = audit_row.organisation_id
     and standard_version.id = audit_row.standard_version_id
    join public.template_questions question_row
      on question_row.organisation_id = standard_version.organisation_id
     and question_row.id = target_question_id
     and question_row.template_version_id = standard_version.template_version_id
    where audit_row.organisation_id = org_id
      and audit_row.id = target_audit_id
  ) then
    raise exception 'question does not belong to audit template version'
      using errcode = '23503';
  end if;

  return private.upsert_template_answer(
    target_submission_id,
    target_question_id,
    target_is_not_applicable,
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value
  );
end;
$$;

create or replace function private.create_five_s_finding(
  target_audit_id uuid,
  target_observation text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null,
  target_action_required boolean default false
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
  new_finding_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S finding creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.five_s_audit_findings (
    organisation_id, audit_id, section_id, question_id, observation,
    severity, priority, action_required, created_by_membership_id
  )
  values (
    org_id, target_audit_id, target_section_id, target_question_id, target_observation,
    target_severity, target_priority, target_action_required, actor_membership_id
  )
  returning id into new_finding_id;

  perform private.enqueue_domain_event(
    org_id, target_audit_id, 'FiveSFindingCreated', new_finding_id::text,
    jsonb_build_object('finding_id', new_finding_id)
  );

  return new_finding_id;
end;
$$;

create or replace function private.complete_five_s_audit(
  target_audit_id uuid
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
  audit_row public.five_s_audits%rowtype;
  standard_row public.five_s_standards%rowtype;
  standard_version_row public.five_s_standard_versions%rowtype;
  template_version_row public.template_versions%rowtype;
  unit_row public.organisation_units%rowtype;
  section_row record;
  question_link record;
  derived_result_status text;
  question_scores numeric[];
  question_weights numeric[];
  question_score numeric;
  computed_section_score numeric;
begin
  if not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S audit completion is not authorised'
      using errcode = '42501';
  end if;

  select audit_item.*
  into audit_row
  from public.five_s_audits audit_item
  where audit_item.organisation_id = org_id
    and audit_item.id = target_audit_id
  for update;

  perform private.calculate_five_s_audit_scores(target_audit_id);

  select audit_item.*
  into audit_row
  from public.five_s_audits audit_item
  where audit_item.organisation_id = org_id
    and audit_item.id = target_audit_id;

  select standard_item.*
  into standard_row
  from public.five_s_standards standard_item
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = standard_item.organisation_id
   and standard_version.standard_id = standard_item.id
  where standard_version.organisation_id = org_id
    and standard_version.id = audit_row.standard_version_id;

  select standard_version_item.*
  into standard_version_row
  from public.five_s_standard_versions standard_version_item
  where standard_version_item.organisation_id = org_id
    and standard_version_item.id = audit_row.standard_version_id;

  select template_version_item.*
  into template_version_row
  from public.template_versions template_version_item
  where template_version_item.organisation_id = org_id
    and template_version_item.id = standard_version_row.template_version_id;

  select unit_item.*
  into unit_row
  from public.organisation_units unit_item
  where unit_item.organisation_id = org_id
    and unit_item.id = audit_row.unit_id;

  derived_result_status := private.derive_five_s_result_status(
    audit_row.overall_score_percent,
    standard_version_row.result_status_mappings
  );

  for section_row in
    select
      section_item.id,
      section_item.title,
      coalesce(weight_row.weight, 1) as weight
    from public.template_sections section_item
    join public.five_s_standard_versions standard_version
      on standard_version.organisation_id = section_item.organisation_id
     and standard_version.template_version_id = section_item.template_version_id
    left join public.five_s_section_weights weight_row
      on weight_row.organisation_id = section_item.organisation_id
     and weight_row.standard_version_id = standard_version.id
     and weight_row.section_id = section_item.id
    where section_item.organisation_id = org_id
      and standard_version.id = audit_row.standard_version_id
    order by section_item.position
  loop
    question_scores := array[]::numeric[];
    question_weights := array[]::numeric[];

    for question_link in
        select
          question_scoring.weight,
          question_scoring.scoring_metadata,
          question_item.question_type,
          answer_item.is_not_applicable,
          answer_item.text_value,
          answer_item.number_value,
          answer_item.json_value
        from public.five_s_question_scoring question_scoring
        join public.template_questions question_item
          on question_item.organisation_id = question_scoring.organisation_id
         and question_item.id = question_scoring.question_id
         and question_item.section_id = section_row.id
        left join public.template_answers answer_item
          on answer_item.organisation_id = question_scoring.organisation_id
         and answer_item.submission_id = audit_row.submission_id
         and answer_item.question_id = question_scoring.question_id
        where question_scoring.organisation_id = org_id
          and question_scoring.standard_version_id = audit_row.standard_version_id
          and question_scoring.contributes_to_score = true
      loop
        question_score := private.extract_scored_answer_value(
          question_link.question_type,
          question_link.scoring_metadata,
          coalesce(question_link.is_not_applicable, false),
          question_link.text_value,
          question_link.number_value,
          question_link.json_value
        );
        if question_score is not null then
          question_scores := array_append(question_scores, question_score);
          question_weights := array_append(question_weights, question_link.weight);
        end if;
      end loop;

      computed_section_score := private.weighted_average(
        question_scores,
        question_weights,
        standard_version_row.weighting_enabled
      );

      insert into public.five_s_audit_score_snapshots (
        organisation_id, audit_id, section_id, section_name_snapshot, score_percent, weight
      )
      values (
        org_id,
        target_audit_id,
        section_row.id,
        section_row.title,
        round(coalesce(computed_section_score, 0), 2),
        section_row.weight
      );
  end loop;

  update public.five_s_audits
  set status = 'completed',
      completed_at = statement_timestamp(),
      target_percent = standard_version_row.target_threshold_percent,
      result_status = derived_result_status,
      standard_name_snapshot = standard_row.display_name,
      template_version_number_snapshot = template_version_row.version_number,
      unit_name_snapshot = unit_row.name,
      unit_code_snapshot = unit_row.code
  where organisation_id = org_id
    and id = target_audit_id;

  perform private.complete_template_submission(audit_row.submission_id);

  if audit_row.schedule_occurrence_id is not null then
    perform private.complete_schedule_occurrence(
      audit_row.schedule_occurrence_id,
      target_audit_id
    );
  end if;

  perform private.append_business_audit(
    org_id, 'five_s.audit.completed', target_audit_id, 'succeeded',
    jsonb_build_object('overall_score_percent', audit_row.overall_score_percent)
  );

  perform private.enqueue_domain_event(
    org_id, target_audit_id, 'FiveSAuditCompleted', target_audit_id::text,
    jsonb_build_object('audit_id', target_audit_id)
  );

  return true;
end;
$$;

create policy five_s_standards_select
on public.five_s_standards for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

create policy five_s_standard_versions_select
on public.five_s_standard_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

create policy five_s_section_weights_select
on public.five_s_section_weights for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

create policy five_s_question_scoring_select
on public.five_s_question_scoring for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

create policy five_s_audits_select
on public.five_s_audits for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, id)
);

create policy five_s_audit_score_snapshots_select
on public.five_s_audit_score_snapshots for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, audit_id)
);

create policy five_s_audit_participants_select
on public.five_s_audit_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, audit_id)
);

create policy five_s_audit_findings_select
on public.five_s_audit_findings for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, audit_id)
);

create policy five_s_evidence_links_select
on public.five_s_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, audit_id)
);

create policy five_s_action_context_select
on public.five_s_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_audit(organisation_id, audit_id)
);

grant select on public.five_s_standards to authenticated;
grant select on public.five_s_standard_versions to authenticated;
grant select on public.five_s_section_weights to authenticated;
grant select on public.five_s_question_scoring to authenticated;
grant select on public.five_s_audits to authenticated;
grant select on public.five_s_audit_score_snapshots to authenticated;
grant select on public.five_s_audit_participants to authenticated;
grant select on public.five_s_audit_findings to authenticated;
grant select on public.five_s_evidence_links to authenticated;
grant select on public.five_s_action_context to authenticated;

create or replace function public.create_five_s_standard_draft(
  target_display_name text,
  target_description text default null,
  target_threshold_percent numeric default 90
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_five_s_standard_draft(target_display_name, target_description, target_threshold_percent) $$;

create or replace function public.add_five_s_section(
  target_standard_version_id uuid,
  target_title text,
  target_position integer
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_five_s_section(target_standard_version_id, target_title, target_position) $$;

create or replace function public.add_five_s_question(
  target_standard_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null,
  target_contributes_to_score boolean default false,
  target_scoring_metadata jsonb default null,
  target_weight numeric default 1
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_five_s_question(
  target_standard_version_id, target_section_id, target_question_type, target_prompt,
  target_position, target_is_required, target_allows_not_applicable, target_help_text,
  target_options, target_contributes_to_score, target_scoring_metadata, target_weight
) $$;

create or replace function public.publish_five_s_standard_version(target_standard_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_five_s_standard_version(target_standard_version_id) $$;

create or replace function public.start_five_s_audit(
  target_standard_id uuid,
  target_unit_id uuid,
  target_schedule_occurrence_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.start_five_s_audit(target_standard_id, target_unit_id, target_schedule_occurrence_id) $$;

create or replace function public.upsert_five_s_audit_answer(
  target_audit_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.upsert_five_s_audit_answer(
  target_audit_id, target_question_id, target_is_not_applicable,
  target_text_value, target_number_value, target_date_value, target_json_value
) $$;

create or replace function public.create_five_s_finding(
  target_audit_id uuid,
  target_observation text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null,
  target_action_required boolean default false
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_five_s_finding(
  target_audit_id, target_observation, target_section_id, target_question_id,
  target_severity, target_priority, target_action_required
) $$;

create or replace function public.complete_five_s_audit(target_audit_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.complete_five_s_audit(target_audit_id) $$;

grant execute on function public.create_five_s_standard_draft(text, text, numeric) to authenticated;
grant execute on function public.add_five_s_section(uuid, text, integer) to authenticated;
grant execute on function public.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) to authenticated;
grant execute on function public.publish_five_s_standard_version(uuid) to authenticated;
grant execute on function public.start_five_s_audit(uuid, uuid, uuid) to authenticated;
grant execute on function public.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;
grant execute on function public.create_five_s_finding(
  uuid, text, uuid, uuid, text, text, boolean
) to authenticated;
grant execute on function public.complete_five_s_audit(uuid) to authenticated;
