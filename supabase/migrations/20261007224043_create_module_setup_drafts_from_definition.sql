-- Atomic organisation-owned DRAFT creation for 5S standards and Gemba
-- definitions from a validated definition. The official LEH catalogue is
-- resolved in application code; these RPCs do not verify LEH provenance and
-- never publish.
--
-- Local migration only. Do not apply this file to hosted Supabase from the
-- agent that introduced it.

create or replace function private.module_setup_require_object(
  candidate jsonb,
  field_name text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if candidate is null
    or pg_catalog.jsonb_typeof(candidate) is distinct from 'object' then
    raise exception 'module setup definition has a malformed %', field_name
      using errcode = '22023';
  end if;

  return candidate;
end;
$$;

create or replace function private.module_setup_require_array(
  candidate jsonb,
  field_name text,
  minimum_length integer,
  maximum_length integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  item_count integer;
begin
  if candidate is null
    or pg_catalog.jsonb_typeof(candidate) is distinct from 'array' then
    raise exception 'module setup definition requires a % array', field_name
      using errcode = '22023';
  end if;

  item_count := jsonb_array_length(candidate);
  if item_count < minimum_length or item_count > maximum_length then
    raise exception 'module setup definition has an invalid % count', field_name
      using errcode = '22023';
  end if;

  return candidate;
end;
$$;

create or replace function private.module_setup_require_text(
  candidate jsonb,
  field_name text,
  minimum_length integer,
  maximum_length integer,
  required boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_text text;
begin
  if candidate is null or candidate = 'null'::jsonb then
    if required then
      raise exception 'module setup definition requires %', field_name
        using errcode = '22023';
    end if;
    return null;
  end if;

  if pg_catalog.jsonb_typeof(candidate) is distinct from 'string' then
    raise exception 'module setup definition has a malformed %', field_name
      using errcode = '22023';
  end if;

  raw_text := btrim(candidate #>> '{}');
  if raw_text = '' then
    if required then
      raise exception 'module setup definition requires %', field_name
        using errcode = '22023';
    end if;
    return null;
  end if;

  if char_length(raw_text) < minimum_length
    or char_length(raw_text) > maximum_length
    or raw_text <> btrim(raw_text) then
    raise exception 'module setup definition has an invalid %', field_name
      using errcode = '22023';
  end if;

  return raw_text;
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

create or replace function private.create_gemba_definition_draft_from_definition(
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
  duration_text text;
  expected_duration integer;
  sections_json jsonb;
  prompts_json jsonb;
  section_item jsonb;
  prompt_item jsonb;
  section_name text;
  prompt_text text;
  help_text text;
  section_count integer := 0;
  prompt_count integer := 0;
  prompts_in_section integer;
  new_definition_id uuid;
  new_version_id uuid;
  new_section_id uuid;
  section_position integer;
  prompt_position integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba definition creation is not authorised'
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
    raise exception 'gemba definition is required'
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

  if definition ? 'expectedDurationMinutes'
    and definition -> 'expectedDurationMinutes' is distinct from 'null'::jsonb then
    duration_text := definition ->> 'expectedDurationMinutes';
    if duration_text is null or duration_text !~ '^[0-9]{1,3}$' then
      raise exception 'gemba definition duration is invalid'
        using errcode = '22023';
    end if;
    expected_duration := duration_text::integer;
    if expected_duration < 10 or expected_duration > 240 then
      raise exception 'gemba definition duration is invalid'
        using errcode = '22023';
    end if;
  else
    expected_duration := null;
  end if;

  if target_unit_ids is null or cardinality(target_unit_ids) < 1 then
    raise exception 'gemba definition requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;
  if cardinality(target_unit_ids) > 50 then
    raise exception 'gemba definition applicability is too large'
      using errcode = '22023';
  end if;

  sections_json := private.module_setup_require_array(
    definition -> 'sections',
    'sections',
    1,
    8
  );

  if (
    select count(*)
    from (
      select lower(btrim(section_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(sections_json) as section_row(value)
    ) named_sections
  ) <> (
    select count(distinct named_sections.normalised_name)
    from (
      select lower(btrim(section_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(sections_json) as section_row(value)
    ) named_sections
  ) then
    raise exception 'gemba definition has duplicate section names'
      using errcode = '22023';
  end if;

  prompt_count := 0;
  for section_item in
    select value
    from jsonb_array_elements(sections_json)
  loop
    perform private.module_setup_require_object(section_item, 'section');
    perform private.module_setup_require_text(section_item -> 'name', 'section name', 1, 160, true);
    prompts_json := private.module_setup_require_array(
      section_item -> 'prompts',
      'prompts',
      1,
      5
    );
    prompts_in_section := 0;
    for prompt_item in
      select value
      from jsonb_array_elements(prompts_json)
    loop
      perform private.module_setup_require_object(prompt_item, 'prompt');
      perform private.module_setup_require_text(prompt_item -> 'prompt', 'prompt', 1, 500, true);
      perform private.module_setup_require_text(
        prompt_item -> 'helpText',
        'prompt guidance',
        1,
        400,
        false
      );
      prompts_in_section := prompts_in_section + 1;
    end loop;
    prompt_count := prompt_count + prompts_in_section;
  end loop;

  if prompt_count > 24 then
    raise exception 'gemba definition has too many prompts'
      using errcode = '22023';
  end if;

  new_definition_id := private.create_gemba_definition_draft(
    display_name,
    display_description,
    expected_duration,
    target_unit_ids
  );

  select definition_version.id
  into new_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.definition_id = new_definition_id
    and definition_version.status = 'draft';

  if new_version_id is null then
    raise exception 'gemba definition draft could not be prepared'
      using errcode = '55000';
  end if;

  section_position := 0;
  for section_item in
    select value
    from jsonb_array_elements(sections_json)
  loop
    section_position := section_position + 1;
    section_name := private.module_setup_require_text(
      section_item -> 'name',
      'section name',
      1,
      160,
      true
    );
    new_section_id := private.add_gemba_section(
      new_version_id,
      section_name,
      section_position
    );
    section_count := section_count + 1;
    prompt_position := 0;
    for prompt_item in
      select value
      from jsonb_array_elements(section_item -> 'prompts')
    loop
      prompt_position := prompt_position + 1;
      prompt_text := private.module_setup_require_text(
        prompt_item -> 'prompt',
        'prompt',
        1,
        500,
        true
      );
      help_text := private.module_setup_require_text(
        prompt_item -> 'helpText',
        'prompt guidance',
        1,
        400,
        false
      );
      perform private.add_gemba_question(
        new_version_id,
        new_section_id,
        'short_text',
        prompt_text,
        prompt_position,
        true,
        false,
        help_text,
        null
      );
    end loop;
  end loop;

  perform private.append_business_audit(
    org_id,
    'gemba.definition.draft_created_from_definition',
    new_definition_id,
    'succeeded',
    jsonb_build_object(
      'declared_template_key', declared_key,
      'definition_version_id', new_version_id,
      'status', 'draft',
      'section_count', section_count,
      'prompt_count', prompt_count
    )
  );

  return new_definition_id;
end;
$$;

create or replace function public.create_five_s_standard_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb,
  target_unit_ids uuid[]
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_five_s_standard_draft_from_definition(
    target_declared_template_key,
    target_definition,
    target_unit_ids
  )
$$;

create or replace function public.create_gemba_definition_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb,
  target_unit_ids uuid[]
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_gemba_definition_draft_from_definition(
    target_declared_template_key,
    target_definition,
    target_unit_ids
  )
$$;

alter function private.module_setup_require_object(jsonb, text)
  owner to lean_hub_private_owner;
alter function private.module_setup_require_array(jsonb, text, integer, integer)
  owner to lean_hub_private_owner;
alter function private.module_setup_require_text(jsonb, text, integer, integer, boolean)
  owner to lean_hub_private_owner;
alter function private.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  owner to lean_hub_private_owner;
alter function private.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])
  owner to lean_hub_private_owner;

revoke all on function private.module_setup_require_object(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.module_setup_require_array(jsonb, text, integer, integer)
  from public, anon, authenticated;
revoke all on function private.module_setup_require_text(jsonb, text, integer, integer, boolean)
  from public, anon, authenticated;
revoke all on function private.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  from public, anon;
revoke all on function private.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])
  from public, anon;
revoke all on function public.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  from public, anon;
revoke all on function public.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])
  from public, anon;

grant execute on function private.module_setup_require_object(jsonb, text)
  to lean_hub_private_owner;
grant execute on function private.module_setup_require_array(jsonb, text, integer, integer)
  to lean_hub_private_owner;
grant execute on function private.module_setup_require_text(jsonb, text, integer, integer, boolean)
  to lean_hub_private_owner;
grant execute on function private.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  to authenticated, lean_hub_private_owner;
grant execute on function private.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])
  to authenticated, lean_hub_private_owner;
grant execute on function public.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])
  to authenticated;
grant execute on function public.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])
  to authenticated;
