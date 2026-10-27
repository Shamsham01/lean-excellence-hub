-- 5S scoring-scale integrity.
--
-- Authoritative scale: five_s_standard_versions.scoring_scale
--   { "min": number, "max": number, "step": number }
-- Question scoring_metadata stays { "type": "direct" } for numeric scores
-- and { "type": "yes_no", "yes_value": 100, "no_value": 0 } for yes/no.
-- A null scale on a published version is the legacy 0–100 step 1 scale.
-- Percentage = ((score - min) / (max - min)) * 100.
-- target_threshold_percent remains the separate pass mark.

create or replace function private.five_s_scoring_scale_is_valid(target_scale jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  scale_min numeric;
  scale_max numeric;
  scale_step numeric;
  scaled_span numeric;
  scaled_step numeric;
begin
  if target_scale is null
    or pg_catalog.jsonb_typeof(target_scale) <> 'object' then
    return false;
  end if;

  if (
    select count(*)
    from pg_catalog.jsonb_object_keys(target_scale) as scale_key
  ) <> 3
    or not (
      target_scale ? 'min'
      and target_scale ? 'max'
      and target_scale ? 'step'
    )
    or pg_catalog.jsonb_typeof(target_scale -> 'min') <> 'number'
    or pg_catalog.jsonb_typeof(target_scale -> 'max') <> 'number'
    or pg_catalog.jsonb_typeof(target_scale -> 'step') <> 'number' then
    return false;
  end if;

  scale_min := (target_scale ->> 'min')::numeric;
  scale_max := (target_scale ->> 'max')::numeric;
  scale_step := (target_scale ->> 'step')::numeric;

  if scale_min <> pg_catalog.round(scale_min, 2)
    or scale_max <> pg_catalog.round(scale_max, 2)
    or scale_step <> pg_catalog.round(scale_step, 2) then
    return false;
  end if;

  if scale_min < 0
    or scale_max > 1000
    or scale_step <= 0
    or scale_max <= scale_min
    or scale_step > (scale_max - scale_min) then
    return false;
  end if;

  scaled_span := pg_catalog.round((scale_max - scale_min) * 100);
  scaled_step := pg_catalog.round(scale_step * 100);
  if scaled_step = 0
    or pg_catalog.mod(scaled_span, scaled_step) <> 0 then
    return false;
  end if;

  if (scaled_span / scaled_step) + 1 > 1001 then
    return false;
  end if;

  return true;
end;
$$;

create or replace function private.five_s_resolve_scoring_scale(target_scale jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when private.five_s_scoring_scale_is_valid(target_scale) then target_scale
    else '{"min":0,"max":100,"step":1}'::jsonb
  end
$$;

create or replace function private.five_s_score_is_on_scale(
  target_value numeric,
  target_scale jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  scale_min numeric;
  scale_max numeric;
  scale_step numeric;
  scaled_offset numeric;
  scaled_step numeric;
begin
  if target_value is null
    or target_value = 'NaN'::numeric
    or not private.five_s_scoring_scale_is_valid(target_scale) then
    return false;
  end if;

  if target_value <> pg_catalog.round(target_value, 2) then
    return false;
  end if;

  scale_min := (target_scale ->> 'min')::numeric;
  scale_max := (target_scale ->> 'max')::numeric;
  scale_step := (target_scale ->> 'step')::numeric;

  if target_value < scale_min or target_value > scale_max then
    return false;
  end if;

  scaled_offset := pg_catalog.round(target_value * 100) - pg_catalog.round(scale_min * 100);
  scaled_step := pg_catalog.round(scale_step * 100);
  if scaled_step = 0 then
    return false;
  end if;

  return pg_catalog.mod(scaled_offset, scaled_step) = 0;
end;
$$;

create or replace function private.five_s_normalise_score_percent(
  target_question_type text,
  target_value numeric,
  target_scale jsonb
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  resolved_scale jsonb;
  scale_min numeric;
  scale_max numeric;
begin
  if target_value is null then
    return null;
  end if;

  if target_question_type = 'yes_no' then
    return target_value;
  end if;

  if target_question_type in ('score', 'number', 'percentage') then
    resolved_scale := private.five_s_resolve_scoring_scale(target_scale);
    if not private.five_s_score_is_on_scale(target_value, resolved_scale) then
      return null;
    end if;
    scale_min := (resolved_scale ->> 'min')::numeric;
    scale_max := (resolved_scale ->> 'max')::numeric;
    if scale_max = scale_min then
      return null;
    end if;
    return pg_catalog.round(((target_value - scale_min) / (scale_max - scale_min)) * 100, 2);
  end if;

  return target_value;
end;
$$;

alter table public.five_s_standard_versions
  add column scoring_scale jsonb;

alter table public.five_s_standard_versions
  add constraint five_s_standard_versions_scoring_scale_check
  check (
    scoring_scale is null
    or private.five_s_scoring_scale_is_valid(scoring_scale)
  );

comment on column public.five_s_standard_versions.scoring_scale is
  'Authoritative numeric scale for this standard version. Null keeps the legacy 0-100 step 1 interpretation. Percentage is ((score - min) / (max - min)) * 100. Pass threshold stays in target_threshold_percent.';

create or replace function private.guard_five_s_published_scoring_scale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status <> 'draft'
    and new.scoring_scale is distinct from old.scoring_scale then
    raise exception 'published 5S scoring scale is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger five_s_standard_versions_scoring_scale_immutable
before update on public.five_s_standard_versions
for each row execute function private.guard_five_s_published_scoring_scale();

create or replace function private.set_five_s_standard_scoring_scale(
  target_standard_version_id uuid,
  target_min numeric,
  target_max numeric,
  target_step numeric
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  requested_scale jsonb;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S scoring scale update is not authorised'
      using errcode = '42501';
  end if;

  requested_scale := pg_catalog.jsonb_build_object(
    'min', target_min,
    'max', target_max,
    'step', target_step
  );

  if not private.five_s_scoring_scale_is_valid(requested_scale) then
    raise exception '5S scoring scale is not valid'
      using errcode = '22023';
  end if;

  update public.five_s_standard_versions version_row
  set scoring_scale = requested_scale
  where version_row.organisation_id = org_id
    and version_row.id = target_standard_version_id
    and version_row.status = 'draft';

  if not found then
    raise exception '5S scoring scale can only be set on a draft version'
      using errcode = '55000';
  end if;

  return true;
end;
$$;

create or replace function public.set_five_s_standard_scoring_scale(
  target_standard_version_id uuid,
  target_min numeric,
  target_max numeric,
  target_step numeric
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_five_s_standard_scoring_scale(
    target_standard_version_id,
    target_min,
    target_max,
    target_step
  )
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
  version_scale jsonb;
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

  if target_contributes_to_score
    and target_question_type in ('score', 'number', 'percentage') then
    select standard_version.scoring_scale
    into version_scale
    from public.five_s_standard_versions standard_version
    where standard_version.organisation_id = org_id
      and standard_version.id = target_standard_version_id
      and standard_version.status = 'draft';

    if not private.five_s_scoring_scale_is_valid(version_scale) then
      raise exception '5S scored questions require an explicit scoring scale on the draft'
        using errcode = '22023';
    end if;

    if target_scoring_metadata is not null
      and (
        target_scoring_metadata ? 'min'
        or target_scoring_metadata ? 'max'
        or target_scoring_metadata ? 'step'
      )
      and (
        not private.five_s_scoring_scale_is_valid(pg_catalog.jsonb_build_object(
          'min', target_scoring_metadata -> 'min',
          'max', target_scoring_metadata -> 'max',
          'step', target_scoring_metadata -> 'step'
        ))
        or (target_scoring_metadata ->> 'min')::numeric
          is distinct from (version_scale ->> 'min')::numeric
        or (target_scoring_metadata ->> 'max')::numeric
          is distinct from (version_scale ->> 'max')::numeric
        or (target_scoring_metadata ->> 'step')::numeric
          is distinct from (version_scale ->> 'step')::numeric
      ) then
      raise exception 'question scoring scale does not match the standard version scale'
        using errcode = '22023';
    end if;

    if coalesce(target_scoring_metadata ->> 'type', 'direct') is distinct from 'direct' then
      raise exception 'scored numeric questions use the standard scoring scale'
        using errcode = '22023';
    end if;

    target_scoring_metadata := '{"type":"direct"}'::jsonb;
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
  linked_template_version_id uuid;
  standard_id uuid;
  version_scale jsonb;
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
    standard_version.standard_id,
    standard_version.scoring_scale
  into linked_template_version_id, standard_id, version_scale
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if not found then
    raise exception '5S standard version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.template_version_id = linked_template_version_id
      and btrim(question_row.prompt) <> ''
  ) then
    raise exception '5S standard version requires at least one question'
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

  if exists (
    select 1
    from public.five_s_question_scoring question_scoring
    join public.template_questions question_row
      on question_row.organisation_id = question_scoring.organisation_id
     and question_row.id = question_scoring.question_id
    where question_scoring.organisation_id = org_id
      and question_scoring.standard_version_id = target_standard_version_id
      and question_scoring.contributes_to_score = true
      and question_row.question_type in ('score', 'number', 'percentage')
  ) and not private.five_s_scoring_scale_is_valid(version_scale) then
    raise exception '5S standard with scored questions requires an explicit scoring scale'
      using errcode = '22023';
  end if;

  if not private.five_s_standard_has_active_applicable_unit(org_id, standard_id) then
    raise exception
      '5S standard requires at least one applicable organisational unit'
      using errcode = '55000';
  end if;

  update public.five_s_standard_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_standard_version_id;

  perform private.publish_template_version_internal(
    linked_template_version_id,
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

create or replace function private.create_five_s_standard_successor_version(
  target_standard_id uuid
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
  source_template_version_id uuid;
  new_template_version_id uuid;
  new_standard_version_id uuid;
  weight_row record;
  scoring_row record;
  new_section_id uuid;
  new_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard successor creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_item.template_id
  into template_id
  from public.five_s_standards standard_item
  where standard_item.organisation_id = org_id
    and standard_item.id = target_standard_id;

  if template_id is null then
    raise exception '5S standard was not found'
      using errcode = '23503';
  end if;

  select version_item.id, version_item.version_number, version_item.template_version_id
  into source_version_id, source_version_number, source_template_version_id
  from public.five_s_standard_versions version_item
  where version_item.organisation_id = org_id
    and version_item.standard_id = target_standard_id
    and version_item.status = 'published'
  order by version_item.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception '5S standard has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.five_s_standard_versions version_item
    where version_item.organisation_id = org_id
      and version_item.standard_id = target_standard_id
      and version_item.status = 'draft'
  ) then
    raise exception '5S standard already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.clone_published_template_version(template_id);

  insert into public.five_s_standard_versions (
    organisation_id,
    standard_id,
    template_version_id,
    version_number,
    status,
    target_threshold_percent,
    weighting_enabled,
    result_status_mappings,
    scoring_scale,
    created_by_membership_id
  )
  select
    org_id,
    target_standard_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.target_threshold_percent,
    source_version.weighting_enabled,
    source_version.result_status_mappings,
    source_version.scoring_scale,
    actor_membership_id
  from public.five_s_standard_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_standard_version_id;

  for weight_row in
    select weight_item.section_id, weight_item.weight, section_item.position
    from public.five_s_section_weights weight_item
    join public.template_sections section_item
      on section_item.organisation_id = weight_item.organisation_id
     and section_item.id = weight_item.section_id
    where weight_item.organisation_id = org_id
      and weight_item.standard_version_id = source_version_id
  loop
    select section_item.id
    into new_section_id
    from public.template_sections section_item
    where section_item.organisation_id = org_id
      and section_item.template_version_id = new_template_version_id
      and section_item.position = weight_row.position;

    insert into public.five_s_section_weights (
      organisation_id, standard_version_id, section_id, weight
    )
    values (org_id, new_standard_version_id, new_section_id, weight_row.weight);
  end loop;

  for scoring_row in
    select
      scoring_item.contributes_to_score,
      scoring_item.scoring_metadata,
      scoring_item.weight,
      section_item.position as section_position,
      question_item.position as question_position
    from public.five_s_question_scoring scoring_item
    join public.template_questions question_item
      on question_item.organisation_id = scoring_item.organisation_id
     and question_item.id = scoring_item.question_id
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where scoring_item.organisation_id = org_id
      and scoring_item.standard_version_id = source_version_id
  loop
    select question_item.id
    into new_question_id
    from public.template_questions question_item
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where question_item.organisation_id = org_id
      and question_item.template_version_id = new_template_version_id
      and section_item.position = scoring_row.section_position
      and question_item.position = scoring_row.question_position;

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
      new_standard_version_id,
      new_question_id,
      scoring_row.contributes_to_score,
      scoring_row.scoring_metadata,
      scoring_row.weight
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.successor_created',
    target_standard_id,
    'succeeded',
    jsonb_build_object(
      'standard_id', target_standard_id,
      'standard_version_id', new_standard_version_id
    )
  );

  return new_standard_version_id;
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
  version_scale jsonb;
begin
  select
    audit_row.standard_version_id,
    audit_row.submission_id,
    standard_version.weighting_enabled,
    standard_version.scoring_scale
  into target_standard_version_id, target_submission_id, weighting_enabled, version_scale
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

      if question_row.question_type in ('score', 'number', 'percentage')
        and question_score is not null
        and not private.five_s_score_is_on_scale(
          question_score,
          private.five_s_resolve_scoring_scale(version_scale)
        ) then
        raise exception '5S audit has a score outside the published scale'
          using errcode = '22023';
      end if;

      if question_row.question_type in ('score', 'number', 'percentage') then
        question_score := private.five_s_normalise_score_percent(
          question_row.question_type,
          question_score,
          version_scale
        );
      end if;

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
  question_type text;
  version_scale jsonb;
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

  select question_row.question_type, standard_version.scoring_scale
  into question_type, version_scale
  from public.five_s_audits audit_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = audit_row.organisation_id
   and standard_version.id = audit_row.standard_version_id
  join public.template_questions question_row
    on question_row.organisation_id = standard_version.organisation_id
   and question_row.id = target_question_id
   and question_row.template_version_id = standard_version.template_version_id
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id;

  if question_type is null then
    raise exception 'question does not belong to audit template version'
      using errcode = '23503';
  end if;

  if not coalesce(target_is_not_applicable, false)
    and question_type in ('score', 'number', 'percentage')
    and (
      target_number_value is null
      or not private.five_s_score_is_on_scale(
        target_number_value,
        private.five_s_resolve_scoring_scale(version_scale)
      )
    ) then
    raise exception '5S score is not on the published scale'
      using errcode = '22023';
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

  if exists (
    select 1
    from public.template_answers answer_item
    join public.template_questions question_item
      on question_item.organisation_id = answer_item.organisation_id
     and question_item.id = answer_item.question_id
    join public.five_s_standard_versions standard_version
      on standard_version.organisation_id = audit_row.organisation_id
     and standard_version.id = audit_row.standard_version_id
    where answer_item.organisation_id = org_id
      and answer_item.submission_id = audit_row.submission_id
      and coalesce(answer_item.is_not_applicable, false) = false
      and question_item.question_type in ('score', 'number', 'percentage')
      and answer_item.number_value is not null
      and not private.five_s_score_is_on_scale(
        answer_item.number_value,
        private.five_s_resolve_scoring_scale(standard_version.scoring_scale)
      )
  ) then
    raise exception '5S audit has a score outside the published scale'
      using errcode = '22023';
  end if;

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
        if question_link.question_type in ('score', 'number', 'percentage')
          and question_score is not null
          and not private.five_s_score_is_on_scale(
            question_score,
            private.five_s_resolve_scoring_scale(standard_version_row.scoring_scale)
          ) then
          raise exception '5S audit has a score outside the published scale'
            using errcode = '22023';
        end if;
        if question_link.question_type in ('score', 'number', 'percentage') then
          question_score := private.five_s_normalise_score_percent(
            question_link.question_type,
            question_score,
            standard_version_row.scoring_scale
          );
        end if;
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

create or replace function private.create_five_s_standard_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb,
  target_unit_ids uuid[]
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
  definition jsonb;
  declared_key text;
  definition_key text;
  display_name text;
  display_description text;
  threshold_text text;
  threshold_percent numeric;
  categories_json jsonb;
  questions_json jsonb;
  category_item jsonb;
  question_item jsonb;
  category_name text;
  question_prompt text;
  question_type text;
  help_text text;
  contributes boolean;
  scoring_metadata jsonb;
  category_count integer := 0;
  question_count integer := 0;
  questions_in_category integer;
  has_scored_question boolean := false;
  requested_scale jsonb;
  new_standard_id uuid;
  new_version_id uuid;
  new_section_id uuid;
  category_position integer;
  question_position integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard creation is not authorised'
      using errcode = '42501';
  end if;

  declared_key := btrim(coalesce(target_declared_template_key, ''));
  if declared_key = ''
    or char_length(declared_key) > 80
    or declared_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'declared template key is invalid'
      using errcode = '22023';
  end if;

  if target_definition is null
    or pg_catalog.jsonb_typeof(target_definition) is distinct from 'object' then
    raise exception '5S standard definition is required'
      using errcode = '22023';
  end if;

  definition := target_definition;
  definition_key := private.module_setup_require_text(definition -> 'key', 'key', 1, 80, true);
  if definition_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or definition_key is distinct from declared_key then
    raise exception 'declared template key does not match the definition'
      using errcode = '22023';
  end if;

  display_name := private.module_setup_require_text(definition -> 'name', 'name', 1, 160, true);
  display_description := private.module_setup_require_text(
    definition -> 'description',
    'description',
    1,
    600,
    true
  );

  threshold_text := definition ->> 'thresholdPercent';
  if threshold_text is null
    or threshold_text !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
    raise exception '5S standard threshold must be a number from 0 to 100'
      using errcode = '22023';
  end if;
  threshold_percent := threshold_text::numeric;
  if threshold_percent < 0 or threshold_percent > 100 then
    raise exception '5S standard threshold must be a number from 0 to 100'
      using errcode = '22023';
  end if;

  if target_unit_ids is null or cardinality(target_unit_ids) < 1 then
    raise exception '5S standard requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;
  if cardinality(target_unit_ids) > 50 then
    raise exception '5S standard applicability is too large'
      using errcode = '22023';
  end if;

  categories_json := private.module_setup_require_array(
    definition -> 'categories',
    'categories',
    1,
    8
  );

  if (
    select count(*)
    from (
      select lower(btrim(category_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(categories_json) as category_row(value)
    ) named_categories
  ) <> (
    select count(distinct named_categories.normalised_name)
    from (
      select lower(btrim(category_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(categories_json) as category_row(value)
    ) named_categories
  ) then
    raise exception '5S standard definition has duplicate category names'
      using errcode = '22023';
  end if;

  question_count := 0;
  for category_item in
    select value
    from jsonb_array_elements(categories_json)
  loop
    perform private.module_setup_require_object(category_item, 'category');
    perform private.module_setup_require_text(category_item -> 'name', 'category name', 1, 160, true);
    questions_json := private.module_setup_require_array(
      category_item -> 'questions',
      'questions',
      1,
      6
    );
    questions_in_category := 0;
    for question_item in
      select value
      from jsonb_array_elements(questions_json)
    loop
      perform private.module_setup_require_object(question_item, 'question');
      perform private.module_setup_require_text(question_item -> 'prompt', 'question prompt', 1, 500, true);
      question_type := private.module_setup_require_text(
        question_item -> 'questionType',
        'question type',
        1,
        32,
        true
      );
      if question_type not in ('yes_no', 'score', 'short_text', 'long_text') then
        raise exception '5S standard definition has an unsupported question type'
          using errcode = '22023';
      end if;
      if question_type = 'score' then
        has_scored_question := true;
      end if;
      perform private.module_setup_require_text(
        question_item -> 'helpText',
        'question guidance',
        1,
        400,
        false
      );
      questions_in_category := questions_in_category + 1;
    end loop;
    question_count := question_count + questions_in_category;
  end loop;

  if question_count > 30 then
    raise exception '5S standard definition has too many questions'
      using errcode = '22023';
  end if;

  requested_scale := definition -> 'scoringScale';
  if requested_scale is null
    or pg_catalog.jsonb_typeof(requested_scale) = 'null' then
    requested_scale := null;
  end if;
  if has_scored_question and requested_scale is null then
    raise exception '5S standard definition requires an explicit scoring scale'
      using errcode = '22023';
  end if;
  if requested_scale is not null
    and not private.five_s_scoring_scale_is_valid(requested_scale) then
    raise exception '5S scoring scale is not valid'
      using errcode = '22023';
  end if;

  new_standard_id := private.create_five_s_standard_draft(
    display_name,
    display_description,
    threshold_percent,
    target_unit_ids
  );

  select standard_version.id
  into new_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.standard_id = new_standard_id
    and standard_version.status = 'draft';

  if new_version_id is null then
    raise exception '5S standard draft could not be prepared'
      using errcode = '55000';
  end if;

  if requested_scale is not null then
    update public.five_s_standard_versions version_row
    set scoring_scale = requested_scale
    where version_row.organisation_id = org_id
      and version_row.id = new_version_id
      and version_row.status = 'draft';
  end if;

  category_position := 0;
  for category_item in
    select value
    from jsonb_array_elements(categories_json)
  loop
    category_position := category_position + 1;
    category_name := private.module_setup_require_text(
      category_item -> 'name',
      'category name',
      1,
      160,
      true
    );
    new_section_id := private.add_five_s_section(
      new_version_id,
      category_name,
      category_position
    );
    category_count := category_count + 1;
    question_position := 0;
    for question_item in
      select value
      from jsonb_array_elements(category_item -> 'questions')
    loop
      question_position := question_position + 1;
      question_prompt := private.module_setup_require_text(
        question_item -> 'prompt',
        'question prompt',
        1,
        500,
        true
      );
      question_type := private.module_setup_require_text(
        question_item -> 'questionType',
        'question type',
        1,
        32,
        true
      );
      help_text := private.module_setup_require_text(
        question_item -> 'helpText',
        'question guidance',
        1,
        400,
        false
      );
      if question_type = 'yes_no' then
        contributes := true;
        scoring_metadata := jsonb_build_object(
          'type', 'yes_no',
          'yes_value', 100,
          'no_value', 0
        );
      elsif question_type = 'score' then
        contributes := true;
        scoring_metadata := jsonb_build_object('type', 'direct');
      else
        contributes := false;
        scoring_metadata := null;
      end if;

      perform private.add_five_s_question(
        new_version_id,
        new_section_id,
        question_type,
        question_prompt,
        question_position,
        true,
        false,
        help_text,
        null,
        contributes,
        scoring_metadata,
        1
      );
    end loop;
  end loop;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.draft_created_from_definition',
    new_standard_id,
    'succeeded',
    jsonb_build_object(
      'declared_template_key', declared_key,
      'standard_version_id', new_version_id,
      'status', 'draft',
      'category_count', category_count,
      'question_count', question_count
    )
  );

  return new_standard_id;
end;
$$;

alter function private.five_s_scoring_scale_is_valid(jsonb)
  owner to lean_hub_private_owner;
alter function private.five_s_resolve_scoring_scale(jsonb)
  owner to lean_hub_private_owner;
alter function private.five_s_score_is_on_scale(numeric, jsonb)
  owner to lean_hub_private_owner;
alter function private.five_s_normalise_score_percent(text, numeric, jsonb)
  owner to lean_hub_private_owner;
alter function private.guard_five_s_published_scoring_scale()
  owner to lean_hub_private_owner;
alter function private.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)
  owner to lean_hub_private_owner;
alter function private.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) owner to lean_hub_private_owner;
alter function private.publish_five_s_standard_version(uuid)
  owner to lean_hub_private_owner;
alter function private.create_five_s_standard_successor_version(uuid)
  owner to lean_hub_private_owner;
alter function private.calculate_five_s_audit_scores(uuid)
  owner to lean_hub_private_owner;
alter function private.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) owner to lean_hub_private_owner;
alter function private.complete_five_s_audit(uuid)
  owner to lean_hub_private_owner;
alter function private.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  owner to lean_hub_private_owner;

revoke all on function private.five_s_scoring_scale_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.five_s_resolve_scoring_scale(jsonb)
  from public, anon, authenticated;
revoke all on function private.five_s_score_is_on_scale(numeric, jsonb)
  from public, anon, authenticated;
revoke all on function private.five_s_normalise_score_percent(text, numeric, jsonb)
  from public, anon, authenticated;
revoke all on function private.guard_five_s_published_scoring_scale()
  from public, anon, authenticated;
revoke all on function private.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)
  from public, anon;

grant execute on function private.five_s_scoring_scale_is_valid(jsonb)
  to lean_hub_private_owner;
grant execute on function private.five_s_resolve_scoring_scale(jsonb)
  to lean_hub_private_owner;
grant execute on function private.five_s_score_is_on_scale(numeric, jsonb)
  to lean_hub_private_owner;
grant execute on function private.five_s_normalise_score_percent(text, numeric, jsonb)
  to lean_hub_private_owner;
grant execute on function private.guard_five_s_published_scoring_scale()
  to lean_hub_private_owner;
grant execute on function private.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)
  to lean_hub_private_owner;
grant execute on function public.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)
  to authenticated;
