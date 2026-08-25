-- Authoritative maturity scoring:
-- Only questions with contributes_to_score = true enter denominators.
-- N/A answers are excluded. Aggregation uses weights when model_version.weighting_enabled.
-- Rounding to 2 decimal places occurs at criterion, pillar, and overall boundaries.

create or replace function private.append_maturity_assessment_transition(
  target_organisation_id uuid,
  target_assessment_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.maturity_assessment_transitions (
    organisation_id,
    assessment_id,
    from_status,
    to_status,
    actor_membership_id,
    reason
  )
  values (
    target_organisation_id,
    target_assessment_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    target_reason
  );
end;
$$;

create or replace function private.validate_scored_question_metadata(
  target_question_type text,
  target_scoring_metadata jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_type text;
begin
  if target_scoring_metadata is null
    or pg_catalog.jsonb_typeof(target_scoring_metadata) <> 'object' then
    return false;
  end if;

  metadata_type := target_scoring_metadata ->> 'type';

  if target_question_type in ('score', 'number', 'percentage', 'risk_rating') then
    return metadata_type is null or metadata_type = 'direct';
  end if;

  if target_question_type = 'yes_no' then
    return metadata_type = 'yes_no'
      and pg_catalog.jsonb_typeof(target_scoring_metadata -> 'yes_value') = 'number'
      and pg_catalog.jsonb_typeof(target_scoring_metadata -> 'no_value') = 'number';
  end if;

  if target_question_type = 'single_select' then
    return metadata_type = 'single_select'
      and pg_catalog.jsonb_typeof(target_scoring_metadata -> 'options') = 'object';
  end if;

  return false;
end;
$$;

create or replace function private.extract_scored_answer_value(
  target_question_type text,
  target_scoring_metadata jsonb,
  target_is_not_applicable boolean,
  target_text_value text,
  target_number_value numeric,
  target_json_value jsonb
)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  metadata_type text;
  answer_key text;
begin
  if target_is_not_applicable then
    return null;
  end if;

  metadata_type := coalesce(target_scoring_metadata ->> 'type', 'direct');

  if target_question_type in ('score', 'number', 'percentage', 'risk_rating') then
    return target_number_value;
  end if;

  if target_question_type = 'yes_no' and metadata_type = 'yes_no' then
    if lower(coalesce(target_text_value, '')) in ('yes', 'true', 'y', '1') then
      return (target_scoring_metadata ->> 'yes_value')::numeric;
    elsif lower(coalesce(target_text_value, '')) in ('no', 'false', 'n', '0') then
      return (target_scoring_metadata ->> 'no_value')::numeric;
    end if;
    return null;
  end if;

  if target_question_type = 'single_select' and metadata_type = 'single_select' then
    answer_key := coalesce(
      target_text_value,
      target_json_value ->> 'value',
      target_json_value ->> 'selected'
    );

    if answer_key is null then
      return null;
    end if;

    return (target_scoring_metadata -> 'options' ->> answer_key)::numeric;
  end if;

  return null;
end;
$$;

create or replace function private.weighted_average(
  target_scores numeric[],
  target_weights numeric[],
  target_weighting_enabled boolean
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  score_item numeric;
  weight_item numeric;
  total_weight numeric := 0;
  weighted_total numeric := 0;
  item_index integer;
begin
  if coalesce(array_length(target_scores, 1), 0) = 0 then
    return null;
  end if;

  if not target_weighting_enabled then
  foreach score_item in array target_scores
  loop
    weighted_total := weighted_total + score_item;
  end loop;
    return round(weighted_total / array_length(target_scores, 1), 2);
  end if;

  for item_index in 1..array_length(target_scores, 1)
  loop
    score_item := target_scores[item_index];
    weight_item := coalesce(target_weights[item_index], 1);
    weighted_total := weighted_total + (score_item * weight_item);
    total_weight := total_weight + weight_item;
  end loop;

  if total_weight = 0 then
    return null;
  end if;

  return round(weighted_total / total_weight, 2);
end;
$$;

create or replace function private.can_read_maturity_assessment(
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
    from public.maturity_assessments assessment_row
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = target_assessment_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'maturity.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'maturity.read',
          null,
          assessment_row.unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'maturity.read',
          assessment_row.created_by_membership_id,
          null
        )
        or (
          assessment_row.lead_assessor_membership_id is not null
          and private.has_scoped_permission(
            target_organisation_id,
            'maturity.read',
            assessment_row.lead_assessor_membership_id,
            null
          )
        )
        or exists (
          select 1
          from public.maturity_assessment_participants participant_row
          where participant_row.organisation_id = assessment_row.organisation_id
            and participant_row.assessment_id = assessment_row.id
            and private.has_scoped_permission(
              target_organisation_id,
              'maturity.read',
              participant_row.membership_id,
              null
            )
        )
      )
  )
$$;

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
begin
  select assessment_item.*
  into assessment_row
  from public.maturity_assessments assessment_item
  where assessment_item.organisation_id = target_organisation_id
    and assessment_item.id = target_assessment_id;

  if not found then
    return false;
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

create or replace function private.create_maturity_model_draft(
  target_display_name text,
  target_description text default null
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
  new_model_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model creation is not authorised'
      using errcode = '42501';
  end if;

  new_model_id := private.register_resource_record(
    org_id,
    'maturity_model',
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
    id,
    organisation_id,
    experience_type,
    display_name,
    description,
    created_by_membership_id
  )
  values (
    new_template_id,
    org_id,
    'maturity_assessment',
    target_display_name,
    target_description,
    actor_membership_id
  );

  insert into public.maturity_models (
    id,
    organisation_id,
    template_id,
    display_name,
    description,
    created_by_membership_id
  )
  values (
    new_model_id,
    org_id,
    new_template_id,
    target_display_name,
    target_description,
    actor_membership_id
  );

  insert into public.template_versions (
    organisation_id,
    template_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_template_id,
    1,
    'draft',
    actor_membership_id
  )
  returning id into new_template_version_id;

  insert into public.maturity_model_versions (
    organisation_id,
    model_id,
    template_version_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_model_id,
    new_template_version_id,
    1,
    'draft',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.model.created',
    new_model_id,
    'succeeded',
    jsonb_build_object('template_id', new_template_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_model_id,
    'MaturityModelCreated',
    new_model_id::text,
    jsonb_build_object('model_id', new_model_id)
  );

  return new_model_id;
end;
$$;

create or replace function private.add_maturity_level(
  target_model_version_id uuid,
  target_level_number integer,
  target_name text,
  target_color_token text,
  target_description text default null,
  target_guidance text default null
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
  new_level_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity level creation is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.id = target_model_version_id
      and model_version.status = 'draft'
  ) then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  insert into public.maturity_levels (
    organisation_id,
    model_version_id,
    level_number,
    name,
    description,
    color_token,
    guidance
  )
  values (
    org_id,
    target_model_version_id,
    target_level_number,
    target_name,
    target_description,
    target_color_token,
    target_guidance
  )
  returning id into new_level_id;

  return new_level_id;
end;
$$;

create or replace function private.add_maturity_pillar(
  target_model_version_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_weight numeric default 1,
  target_guidance text default null,
  target_section_title text default null
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
  new_pillar_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity pillar creation is not authorised'
      using errcode = '42501';
  end if;

  select model_version.template_version_id
  into template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft';

  if template_version_id is null then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  new_section_id := private.add_template_section_internal(
    template_version_id,
    coalesce(target_section_title, target_name),
    target_position
  );

  insert into public.maturity_pillars (
    organisation_id,
    model_version_id,
    section_id,
    position,
    name,
    description,
    weight,
    guidance
  )
  values (
    org_id,
    target_model_version_id,
    new_section_id,
    target_position,
    target_name,
    target_description,
    target_weight,
    target_guidance
  )
  returning id into new_pillar_id;

  return new_pillar_id;
end;
$$;

create or replace function private.add_maturity_question(
  target_model_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity question creation is not authorised'
      using errcode = '42501';
  end if;

  select model_version.template_version_id
  into template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft';

  if template_version_id is null then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  return private.add_template_question_internal(
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
end;
$$;

create or replace function private.add_maturity_criterion(
  target_pillar_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_expected_evidence text default null,
  target_guidance text default null,
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
  actor_membership_id uuid := private.current_membership_id(org_id);
  model_version_id uuid;
  new_criterion_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity criterion creation is not authorised'
      using errcode = '42501';
  end if;

  select pillar_row.model_version_id
  into model_version_id
  from public.maturity_pillars pillar_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id;

  if model_version_id is null then
    raise exception 'maturity pillar is not editable'
      using errcode = '55000';
  end if;

  insert into public.maturity_criteria (
    organisation_id,
    pillar_id,
    position,
    name,
    description,
    expected_evidence,
    guidance,
    weight
  )
  values (
    org_id,
    target_pillar_id,
    target_position,
    target_name,
    target_description,
    target_expected_evidence,
    target_guidance,
    target_weight
  )
  returning id into new_criterion_id;

  return new_criterion_id;
end;
$$;

create or replace function private.link_criterion_question(
  target_criterion_id uuid,
  target_question_id uuid,
  target_contributes_to_score boolean default false,
  target_scoring_metadata jsonb default null
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
  model_version_id uuid;
  question_type text;
  new_link_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'criterion question linking is not authorised'
      using errcode = '42501';
  end if;

  select pillar_row.model_version_id, question_row.question_type
  into model_version_id, question_type
  from public.maturity_criteria criterion_row
  join public.maturity_pillars pillar_row
    on pillar_row.organisation_id = criterion_row.organisation_id
   and pillar_row.id = criterion_row.pillar_id
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  join public.template_questions question_row
    on question_row.organisation_id = model_version.organisation_id
   and question_row.id = target_question_id
   and question_row.template_version_id = model_version.template_version_id
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id;

  if model_version_id is null then
    raise exception 'criterion question link is not editable'
      using errcode = '55000';
  end if;

  if target_contributes_to_score
    and not private.validate_scored_question_metadata(
      question_type,
      target_scoring_metadata
    ) then
    raise exception 'scored question requires valid scoring metadata'
      using errcode = '22023';
  end if;

  insert into public.maturity_criterion_questions (
    organisation_id,
    criterion_id,
    question_id,
    contributes_to_score,
    scoring_metadata
  )
  values (
    org_id,
    target_criterion_id,
    target_question_id,
    target_contributes_to_score,
    target_scoring_metadata
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.publish_maturity_model_version(
  target_model_version_id uuid
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
  model_id uuid;
  template_version_id uuid;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model publication is not authorised'
      using errcode = '42501';
  end if;

  select model_version.model_id, model_version.template_version_id
  into model_id, template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft'
  for update;

  if not found then
    raise exception 'maturity model version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_levels level_row
    where level_row.organisation_id = org_id
      and level_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one level'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one pillar'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_link.scoring_metadata,
      question_row.question_type
    from public.maturity_criterion_questions question_link
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = question_link.organisation_id
     and criterion_row.id = question_link.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = target_model_version_id
    join public.template_questions question_row
      on question_row.organisation_id = question_link.organisation_id
     and question_row.id = question_link.question_id
    where question_link.organisation_id = org_id
      and question_link.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  update public.maturity_model_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_model_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.model.published',
    model_id,
    'succeeded',
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    model_id,
    'MaturityModelPublished',
    target_model_version_id::text,
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_maturity_model_successor_version(
  target_model_id uuid
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
  template_id uuid;
  source_version_id uuid;
  source_version_number integer;
  new_template_version_id uuid;
  new_model_version_id uuid;
  level_row record;
  pillar_row record;
  criterion_row record;
  question_link record;
  pillar_map jsonb := '{}'::jsonb;
  criterion_map jsonb := '{}'::jsonb;
  new_pillar_id uuid;
  new_criterion_id uuid;
  new_section_id uuid;
  new_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model successor creation is not authorised'
      using errcode = '42501';
  end if;

  select maturity_model.template_id
  into template_id
  from public.maturity_models maturity_model
  where maturity_model.organisation_id = org_id
    and maturity_model.id = target_model_id;

  if template_id is null then
    raise exception 'maturity model was not found'
      using errcode = '23503';
  end if;

  select model_version.id, model_version.version_number
  into source_version_id, source_version_number
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.model_id = target_model_id
    and model_version.status = 'published'
  order by model_version.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'maturity model has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.model_id = target_model_id
      and model_version.status = 'draft'
  ) then
    raise exception 'maturity model already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.create_template_successor_version_internal(template_id);

  insert into public.maturity_model_versions (
    organisation_id,
    model_id,
    template_version_id,
    version_number,
    status,
    weighting_enabled,
    created_by_membership_id
  )
  select
    org_id,
    target_model_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.weighting_enabled,
    actor_membership_id
  from public.maturity_model_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_model_version_id;

  for level_row in
    select level_item.*
    from public.maturity_levels level_item
    where level_item.organisation_id = org_id
      and level_item.model_version_id = source_version_id
    order by level_item.level_number
  loop
    insert into public.maturity_levels (
      organisation_id,
      model_version_id,
      level_number,
      name,
      description,
      color_token,
      guidance
    )
    values (
      org_id,
      new_model_version_id,
      level_row.level_number,
      level_row.name,
      level_row.description,
      level_row.color_token,
      level_row.guidance
    );
  end loop;

  for pillar_row in
    select pillar_item.*
    from public.maturity_pillars pillar_item
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = source_version_id
    order by pillar_item.position
  loop
    select section_item.id
    into new_section_id
    from public.template_sections section_item
    where section_item.organisation_id = org_id
      and section_item.template_version_id = new_template_version_id
      and section_item.position = pillar_row.position;

    insert into public.maturity_pillars (
      organisation_id,
      model_version_id,
      section_id,
      position,
      name,
      description,
      weight,
      guidance
    )
    values (
      org_id,
      new_model_version_id,
      new_section_id,
      pillar_row.position,
      pillar_row.name,
      pillar_row.description,
      pillar_row.weight,
      pillar_row.guidance
    )
    returning id into new_pillar_id;

    pillar_map := pillar_map || jsonb_build_object(pillar_row.id::text, new_pillar_id);
  end loop;

  for criterion_row in
    select criterion_item.*
    from public.maturity_criteria criterion_item
    join public.maturity_pillars pillar_item
      on pillar_item.organisation_id = criterion_item.organisation_id
     and pillar_item.id = criterion_item.pillar_id
    where criterion_item.organisation_id = org_id
      and pillar_item.model_version_id = source_version_id
    order by pillar_item.position, criterion_item.position
  loop
    insert into public.maturity_criteria (
      organisation_id,
      pillar_id,
      position,
      name,
      description,
      expected_evidence,
      guidance,
      weight
    )
    values (
      org_id,
      (pillar_map ->> criterion_row.pillar_id::text)::uuid,
      criterion_row.position,
      criterion_row.name,
      criterion_row.description,
      criterion_row.expected_evidence,
      criterion_row.guidance,
      criterion_row.weight
    )
    returning id into new_criterion_id;

    criterion_map := criterion_map || jsonb_build_object(
      criterion_row.id::text,
      new_criterion_id
    );
  end loop;

  for question_link in
    select
      link_item.*,
      question_item.position as question_position,
      section_item.position as section_position
    from public.maturity_criterion_questions link_item
    join public.template_questions question_item
      on question_item.organisation_id = link_item.organisation_id
     and question_item.id = link_item.question_id
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    join public.maturity_criteria criterion_item
      on criterion_item.organisation_id = link_item.organisation_id
     and criterion_item.id = link_item.criterion_id
    join public.maturity_pillars pillar_item
      on pillar_item.organisation_id = criterion_item.organisation_id
     and pillar_item.id = criterion_item.pillar_id
     and pillar_item.model_version_id = source_version_id
    where link_item.organisation_id = org_id
  loop
    select question_item.id
    into new_question_id
    from public.template_questions question_item
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where question_item.organisation_id = org_id
      and question_item.template_version_id = new_template_version_id
      and section_item.position = question_link.section_position
      and question_item.position = question_link.question_position;

    insert into public.maturity_criterion_questions (
      organisation_id,
      criterion_id,
      question_id,
      contributes_to_score,
      scoring_metadata
    )
    values (
      org_id,
      (criterion_map ->> question_link.criterion_id::text)::uuid,
      new_question_id,
      question_link.contributes_to_score,
      question_link.scoring_metadata
    );
  end loop;

  return new_model_version_id;
end;
$$;

create or replace function private.start_maturity_assessment(
  target_model_version_id uuid,
  target_unit_id uuid,
  target_assessment_type text,
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
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'maturity assessment start is not authorised'
      using errcode = '42501';
  end if;

  if target_assessment_type not in ('self', 'formal') then
    raise exception 'invalid assessment type'
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
    target_lead_assessor_membership_id,
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
    jsonb_build_object('assessment_type', target_assessment_type)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_assessment_id,
    'AssessmentStarted',
    new_assessment_id::text,
    jsonb_build_object('assessment_id', new_assessment_id)
  );

  return new_assessment_id;
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment answer upsert is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.submission_id
  into target_submission_id
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

  return answer_id;
end;
$$;

create or replace function private.calculate_maturity_assessment_scores(
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
  target_model_version_id uuid;
  target_submission_id uuid;
  weighting_enabled boolean;
  criterion_row record;
  pillar_row record;
  question_row record;
  question_scores numeric[] := array[]::numeric[];
  question_weights numeric[] := array[]::numeric[];
  criterion_scores numeric[] := array[]::numeric[];
  criterion_weights numeric[] := array[]::numeric[];
  pillar_scores numeric[] := array[]::numeric[];
  pillar_weights numeric[] := array[]::numeric[];
  question_score numeric;
  criterion_score numeric;
  pillar_score numeric;
  overall_score numeric;
begin
  select
    assessment_row.model_version_id,
    assessment_row.submission_id,
    model_version.weighting_enabled
  into target_model_version_id, target_submission_id, weighting_enabled
  from public.maturity_assessments assessment_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = assessment_row.organisation_id
   and model_version.id = assessment_row.model_version_id
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id;

  if target_model_version_id is null then
    raise exception 'assessment was not found'
      using errcode = '23503';
  end if;

  delete from public.maturity_assessment_scores score_row
  where score_row.organisation_id = org_id
    and score_row.assessment_id = target_assessment_id;

  for criterion_row in
    select criterion_item.*
    from public.maturity_criteria criterion_item
    join public.maturity_pillars pillar_item
      on pillar_item.organisation_id = criterion_item.organisation_id
     and pillar_item.id = criterion_item.pillar_id
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = target_model_version_id
    order by pillar_item.position, criterion_item.position
  loop
    question_scores := array[]::numeric[];
    question_weights := array[]::numeric[];

    for question_row in
      select
        question_link.question_id,
        question_link.scoring_metadata,
        question_item.question_type,
        answer_item.is_not_applicable,
        answer_item.text_value,
        answer_item.number_value,
        answer_item.json_value
      from public.maturity_criterion_questions question_link
      join public.template_questions question_item
        on question_item.organisation_id = question_link.organisation_id
       and question_item.id = question_link.question_id
      left join public.template_answers answer_item
        on answer_item.organisation_id = question_link.organisation_id
       and answer_item.submission_id = target_submission_id
       and answer_item.question_id = question_link.question_id
      where question_link.organisation_id = org_id
        and question_link.criterion_id = criterion_row.id
        and question_link.contributes_to_score = true
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
        question_weights := array_append(question_weights, 1);
      end if;
    end loop;

    criterion_score := private.weighted_average(
      question_scores,
      question_weights,
      weighting_enabled
    );

    if criterion_score is not null then
      insert into public.maturity_assessment_scores (
        organisation_id,
        assessment_id,
        score_level,
        entity_id,
        score
      )
      values (
        org_id,
        target_assessment_id,
        'criterion',
        criterion_row.id,
        criterion_score
      );

      criterion_scores := array_append(criterion_scores, criterion_score);
      criterion_weights := array_append(
        criterion_weights,
        case when weighting_enabled then criterion_row.weight else 1 end
      );
    end if;
  end loop;

  for pillar_row in
    select pillar_item.*
    from public.maturity_pillars pillar_item
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = target_model_version_id
    order by pillar_item.position
  loop
    criterion_scores := array[]::numeric[];
    criterion_weights := array[]::numeric[];

    for criterion_row in
      select criterion_item.*
      from public.maturity_criteria criterion_item
      where criterion_item.organisation_id = org_id
        and criterion_item.pillar_id = pillar_row.id
      order by criterion_item.position
    loop
      select score_row.score
      into criterion_score
      from public.maturity_assessment_scores score_row
      where score_row.organisation_id = org_id
        and score_row.assessment_id = target_assessment_id
        and score_row.score_level = 'criterion'
        and score_row.entity_id = criterion_row.id;

      if criterion_score is not null then
        criterion_scores := array_append(criterion_scores, criterion_score);
        criterion_weights := array_append(
          criterion_weights,
          case when weighting_enabled then criterion_row.weight else 1 end
        );
      end if;
    end loop;

    pillar_score := private.weighted_average(
      criterion_scores,
      criterion_weights,
      weighting_enabled
    );

    if pillar_score is not null then
      insert into public.maturity_assessment_scores (
        organisation_id,
        assessment_id,
        score_level,
        entity_id,
        score
      )
      values (
        org_id,
        target_assessment_id,
        'pillar',
        pillar_row.id,
        pillar_score
      );

      pillar_scores := array_append(pillar_scores, pillar_score);
      pillar_weights := array_append(
        pillar_weights,
        case when weighting_enabled then pillar_row.weight else 1 end
      );
    end if;
  end loop;

  overall_score := private.weighted_average(
    pillar_scores,
    pillar_weights,
    weighting_enabled
  );

  if overall_score is not null then
    insert into public.maturity_assessment_scores (
      organisation_id,
      assessment_id,
      score_level,
      entity_id,
      score
    )
    values (
      org_id,
      target_assessment_id,
      'overall',
      null,
      overall_score
    );
  end if;

  return true;
end;
$$;

create or replace function private.submit_maturity_assessment(
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
  missing_required integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment submission is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status
  into current_status
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'formal'
    and assessment_row.status = 'in_progress'
  for update;

  if not found then
    raise exception 'maturity assessment is not submittable'
      using errcode = '55000';
  end if;

  select count(*)
  into missing_required
  from public.maturity_criterion_questions question_link
  join public.template_questions question_row
    on question_row.organisation_id = question_link.organisation_id
   and question_row.id = question_link.question_id
  join public.maturity_criteria criterion_row
    on criterion_row.organisation_id = question_link.organisation_id
   and criterion_row.id = question_link.criterion_id
  join public.maturity_pillars pillar_row
    on pillar_row.organisation_id = criterion_row.organisation_id
   and pillar_row.id = criterion_row.pillar_id
  join public.maturity_assessments assessment_row
    on assessment_row.organisation_id = pillar_row.organisation_id
   and assessment_row.model_version_id = pillar_row.model_version_id
   and assessment_row.id = target_assessment_id
  left join public.template_answers answer_row
    on answer_row.organisation_id = assessment_row.organisation_id
   and answer_row.submission_id = assessment_row.submission_id
   and answer_row.question_id = question_link.question_id
  where question_link.organisation_id = org_id
    and question_row.is_required = true
    and (
      answer_row.id is null
      or (
        not answer_row.is_not_applicable
        and answer_row.text_value is null
        and answer_row.number_value is null
        and answer_row.date_value is null
        and answer_row.json_value is null
      )
    );

  if missing_required > 0 then
    raise exception 'required maturity assessment questions are unanswered'
      using errcode = '55000';
  end if;

  update public.maturity_assessments
  set status = 'submitted',
      submitted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'submitted',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.submitted',
    target_assessment_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_assessment_id,
    'AssessmentSubmitted',
    target_assessment_id::text,
    jsonb_build_object('assessment_id', target_assessment_id)
  );

  return true;
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.review', null, null) then
    raise exception 'assessor review is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status
  into current_status
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.approve', null, null) then
    raise exception 'maturity assessment approval is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status
  into current_status
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
  overall_score numeric;
  official_result_id uuid;
  pillar_row record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.results.publish', null, null) then
    raise exception 'official maturity result publication is not authorised'
      using errcode = '42501';
  end if;

  select
    assessment_row.status,
    assessment_row.model_version_id,
    assessment_row.submission_id
  into current_status, target_model_version_id, target_submission_id
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

  insert into public.maturity_official_results (
    organisation_id,
    assessment_id,
    model_version_id,
    overall_score,
    published_by_membership_id,
    published_at
  )
  values (
    org_id,
    target_assessment_id,
    target_model_version_id,
    overall_score,
    actor_membership_id,
    statement_timestamp()
  )
  returning id into official_result_id;

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
    jsonb_build_object('official_result_id', official_result_id)
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

create or replace function private.complete_self_assessment(
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
  target_submission_id uuid;
  missing_required integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'self assessment completion is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status, assessment_row.submission_id
  into current_status, target_submission_id
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.assessment_type = 'self'
    and assessment_row.status = 'in_progress'
  for update;

  if not found then
    raise exception 'self assessment is not completable'
      using errcode = '55000';
  end if;

  select count(*)
  into missing_required
  from public.maturity_criterion_questions question_link
  join public.template_questions question_row
    on question_row.organisation_id = question_link.organisation_id
   and question_row.id = question_link.question_id
  join public.maturity_criteria criterion_row
    on criterion_row.organisation_id = question_link.organisation_id
   and criterion_row.id = question_link.criterion_id
  join public.maturity_pillars pillar_row
    on pillar_row.organisation_id = criterion_row.organisation_id
   and pillar_row.id = criterion_row.pillar_id
  join public.maturity_assessments assessment_row
    on assessment_row.organisation_id = pillar_row.organisation_id
   and assessment_row.model_version_id = pillar_row.model_version_id
   and assessment_row.id = target_assessment_id
  left join public.template_answers answer_row
    on answer_row.organisation_id = assessment_row.organisation_id
   and answer_row.submission_id = assessment_row.submission_id
   and answer_row.question_id = question_link.question_id
  where question_link.organisation_id = org_id
    and question_row.is_required = true
    and (
      answer_row.id is null
      or (
        not answer_row.is_not_applicable
        and answer_row.text_value is null
        and answer_row.number_value is null
        and answer_row.date_value is null
        and answer_row.json_value is null
      )
    );

  if missing_required > 0 then
    raise exception 'required maturity assessment questions are unanswered'
      using errcode = '55000';
  end if;

  perform private.calculate_maturity_assessment_scores(target_assessment_id);

  update public.maturity_assessments
  set status = 'completed',
      completed_at = statement_timestamp(),
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
    'completed',
    actor_membership_id
  );

  return true;
end;
$$;

create or replace function private.cancel_maturity_assessment(
  target_assessment_id uuid,
  target_reason text default null
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_read_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment cancellation is not authorised'
      using errcode = '42501';
  end if;

  select assessment_row.status
  into current_status
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = org_id
    and assessment_row.id = target_assessment_id
    and assessment_row.status in (
      'draft',
      'in_progress',
      'submitted',
      'assessor_review',
      'approved'
    )
  for update;

  if not found then
    raise exception 'maturity assessment is not cancellable'
      using errcode = '55000';
  end if;

  update public.maturity_assessments
  set status = 'cancelled',
      cancelled_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_assessment_id;

  perform private.append_maturity_assessment_transition(
    org_id,
    target_assessment_id,
    current_status,
    'cancelled',
    actor_membership_id,
    target_reason
  );

  return true;
end;
$$;

create or replace function private.link_maturity_evidence(
  target_assessment_id uuid,
  target_attachment_id uuid,
  target_criterion_id uuid,
  target_question_id uuid default null
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
  new_link_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity evidence linking is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.organisation_id = org_id
      and attachment_row.id = target_attachment_id
      and attachment_row.target_resource_id = target_assessment_id
      and attachment_row.lifecycle = 'active'
  ) then
    raise exception 'attachment is not linked to assessment'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = assessment_row.organisation_id
     and criterion_row.id = target_criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = assessment_row.model_version_id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'criterion does not belong to assessment model version'
      using errcode = '23503';
  end if;

  if target_question_id is not null
    and not exists (
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

  insert into public.maturity_evidence_links (
    organisation_id,
    assessment_id,
    attachment_id,
    criterion_id,
    question_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_assessment_id,
    target_attachment_id,
    target_criterion_id,
    target_question_id,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
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
    or not private.can_read_maturity_assessment(org_id, target_assessment_id) then
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

create or replace function public.create_maturity_model_draft(
  target_display_name text,
  target_description text default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.create_maturity_model_draft(target_display_name, target_description) $$;

create or replace function public.add_maturity_level(
  target_model_version_id uuid,
  target_level_number integer,
  target_name text,
  target_color_token text,
  target_description text default null,
  target_guidance text default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.add_maturity_level(
    target_model_version_id,
    target_level_number,
    target_name,
    target_color_token,
    target_description,
    target_guidance
  )
$$;

create or replace function public.add_maturity_pillar(
  target_model_version_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_weight numeric default 1,
  target_guidance text default null,
  target_section_title text default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.add_maturity_pillar(
    target_model_version_id,
    target_name,
    target_position,
    target_description,
    target_weight,
    target_guidance,
    target_section_title
  )
$$;

create or replace function public.add_maturity_question(
  target_model_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.add_maturity_question(
    target_model_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    target_position,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  )
$$;

create or replace function public.add_maturity_criterion(
  target_pillar_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_expected_evidence text default null,
  target_guidance text default null,
  target_weight numeric default 1
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.add_maturity_criterion(
    target_pillar_id,
    target_name,
    target_position,
    target_description,
    target_expected_evidence,
    target_guidance,
    target_weight
  )
$$;

create or replace function public.link_criterion_question(
  target_criterion_id uuid,
  target_question_id uuid,
  target_contributes_to_score boolean default false,
  target_scoring_metadata jsonb default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.link_criterion_question(
    target_criterion_id,
    target_question_id,
    target_contributes_to_score,
    target_scoring_metadata
  )
$$;

create or replace function public.publish_maturity_model_version(target_model_version_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.publish_maturity_model_version(target_model_version_id) $$;

create or replace function public.create_maturity_model_successor_version(target_model_id uuid)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.create_maturity_model_successor_version(target_model_id) $$;

create or replace function public.start_maturity_assessment(
  target_model_version_id uuid,
  target_unit_id uuid,
  target_assessment_type text,
  target_lead_assessor_membership_id uuid default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.start_maturity_assessment(
    target_model_version_id,
    target_unit_id,
    target_assessment_type,
    target_lead_assessor_membership_id
  )
$$;

create or replace function public.upsert_maturity_assessment_answer(
  target_assessment_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.upsert_maturity_assessment_answer(
    target_assessment_id,
    target_question_id,
    target_is_not_applicable,
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value
  )
$$;

create or replace function public.submit_maturity_assessment(target_assessment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.submit_maturity_assessment(target_assessment_id) $$;

create or replace function public.begin_assessor_review(target_assessment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.begin_assessor_review(target_assessment_id) $$;

create or replace function public.approve_maturity_assessment(target_assessment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.approve_maturity_assessment(target_assessment_id) $$;

create or replace function public.publish_official_maturity_result(target_assessment_id uuid)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.publish_official_maturity_result(target_assessment_id) $$;

create or replace function public.complete_self_assessment(target_assessment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.complete_self_assessment(target_assessment_id) $$;

create or replace function public.cancel_maturity_assessment(
  target_assessment_id uuid,
  target_reason text default null
)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.cancel_maturity_assessment(target_assessment_id, target_reason) $$;

create or replace function public.calculate_maturity_assessment_scores(target_assessment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.calculate_maturity_assessment_scores(target_assessment_id) $$;

create or replace function public.link_maturity_evidence(
  target_assessment_id uuid,
  target_attachment_id uuid,
  target_criterion_id uuid,
  target_question_id uuid default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.link_maturity_evidence(
    target_assessment_id,
    target_attachment_id,
    target_criterion_id,
    target_question_id
  )
$$;

create or replace function public.create_maturity_action(
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
language sql volatile security invoker set search_path = ''
as $$
  select private.create_maturity_action(
    target_title,
    target_assessment_id,
    target_pillar_id,
    target_criterion_id,
    target_question_id,
    target_description,
    target_priority,
    target_due_at
  )
$$;

create or replace function public.can_read_maturity_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.can_read_maturity_assessment(
    target_organisation_id,
    target_assessment_id
  )
$$;

grant execute on function public.create_maturity_model_draft(text, text) to authenticated;
grant execute on function public.add_maturity_level(
  uuid, integer, text, text, text, text
) to authenticated;
grant execute on function public.add_maturity_pillar(
  uuid, text, integer, text, numeric, text, text
) to authenticated;
grant execute on function public.add_maturity_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) to authenticated;
grant execute on function public.add_maturity_criterion(
  uuid, text, integer, text, text, text, numeric
) to authenticated;
grant execute on function public.link_criterion_question(
  uuid, uuid, boolean, jsonb
) to authenticated;
grant execute on function public.publish_maturity_model_version(uuid) to authenticated;
grant execute on function public.create_maturity_model_successor_version(uuid) to authenticated;
grant execute on function public.start_maturity_assessment(
  uuid, uuid, text, uuid
) to authenticated;
grant execute on function public.upsert_maturity_assessment_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;
grant execute on function public.submit_maturity_assessment(uuid) to authenticated;
grant execute on function public.begin_assessor_review(uuid) to authenticated;
grant execute on function public.approve_maturity_assessment(uuid) to authenticated;
grant execute on function public.publish_official_maturity_result(uuid) to authenticated;
grant execute on function public.complete_self_assessment(uuid) to authenticated;
grant execute on function public.cancel_maturity_assessment(uuid, text) to authenticated;
grant execute on function public.calculate_maturity_assessment_scores(uuid) to authenticated;
grant execute on function public.link_maturity_evidence(
  uuid, uuid, uuid, uuid
) to authenticated;
grant execute on function public.create_maturity_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.can_read_maturity_assessment(uuid, uuid) to authenticated;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.append_maturity_assessment_transition(uuid,uuid,text,text,uuid,text)'::regprocedure,
    'private.validate_scored_question_metadata(text,jsonb)'::regprocedure,
    'private.extract_scored_answer_value(text,jsonb,boolean,text,numeric,jsonb)'::regprocedure,
    'private.weighted_average(numeric[],numeric[],boolean)'::regprocedure,
    'private.can_edit_maturity_assessment(uuid,uuid)'::regprocedure,
    'private.create_maturity_model_draft(text,text)'::regprocedure,
    'private.add_maturity_level(uuid,integer,text,text,text,text)'::regprocedure,
    'private.add_maturity_pillar(uuid,text,integer,text,numeric,text,text)'::regprocedure,
    'private.add_maturity_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb)'::regprocedure,
    'private.add_maturity_criterion(uuid,text,integer,text,text,text,numeric)'::regprocedure,
    'private.link_criterion_question(uuid,uuid,boolean,jsonb)'::regprocedure,
    'private.publish_maturity_model_version(uuid)'::regprocedure,
    'private.create_maturity_model_successor_version(uuid)'::regprocedure,
    'private.start_maturity_assessment(uuid,uuid,text,uuid)'::regprocedure,
    'private.upsert_maturity_assessment_answer(uuid,uuid,boolean,text,numeric,date,jsonb)'::regprocedure,
    'private.calculate_maturity_assessment_scores(uuid)'::regprocedure,
    'private.submit_maturity_assessment(uuid)'::regprocedure,
    'private.begin_assessor_review(uuid)'::regprocedure,
    'private.approve_maturity_assessment(uuid)'::regprocedure,
    'private.publish_official_maturity_result(uuid)'::regprocedure,
    'private.complete_self_assessment(uuid)'::regprocedure,
    'private.cancel_maturity_assessment(uuid,text)'::regprocedure,
    'private.link_maturity_evidence(uuid,uuid,uuid,uuid)'::regprocedure,
    'private.create_maturity_action(text,uuid,uuid,uuid,uuid,text,text,timestamptz)'::regprocedure
  ]
  loop
    execute format('alter function %s owner to lean_hub_private_owner', function_signature);
  end loop;
end
$$;

alter function private.can_read_maturity_assessment(uuid, uuid)
  owner to lean_hub_private_owner;
