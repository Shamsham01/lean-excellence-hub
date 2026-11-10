-- Restrict 5S authoring to yes_no and score questions; keep structural locking from #387.

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
  version_status text;
  new_question_id uuid;
  version_scale jsonb;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S question creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.template_version_id, standard_version.status
  into template_version_id, version_status
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
  for update of standard_version;

  if template_version_id is null or version_status <> 'draft' then
    raise exception '5S standard version is not editable'
      using errcode = '55000';
  end if;

  if btrim(coalesce(target_question_type, '')) = ''
    or target_question_type not in ('yes_no', 'score') then
    raise exception '5S question type is not supported'
      using errcode = '22023';
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
      if question_type not in ('yes_no', 'score') then
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

alter function private.create_five_s_standard_draft_from_definition(text, jsonb, uuid[]) owner to lean_hub_private_owner;
