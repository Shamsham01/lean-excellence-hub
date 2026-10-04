-- Replace the Quick Start bulk RPC with a permission-checked draft creator
-- that accepts a caller-supplied definition. The official LEH catalogue is
-- resolved in application code; this RPC does not verify LEH provenance.
-- Do not apply this migration to hosted Supabase from this change.

drop function if exists public.instantiate_maturity_quick_start_template(text, jsonb);
drop function if exists private.instantiate_maturity_quick_start_template(text, jsonb);

create or replace function private.maturity_definition_require_array(
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
    or pg_catalog.jsonb_typeof(candidate) is distinct from 'array' then
    raise exception 'maturity framework definition requires a non-empty % array', field_name
      using errcode = '22023';
  end if;

  if jsonb_array_length(candidate) < 1 then
    raise exception 'maturity framework definition requires a non-empty % array', field_name
      using errcode = '22023';
  end if;

  return candidate;
end;
$$;

create or replace function private.maturity_definition_require_object(
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
    raise exception 'maturity framework definition has a malformed %', field_name
      using errcode = '22023';
  end if;

  return candidate;
end;
$$;

create or replace function private.create_maturity_model_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb
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
  definition jsonb := target_definition;
  declared_key text;
  definition_key text;
  display_name text;
  display_description text;
  scopes_json jsonb;
  levels_json jsonb;
  pillars_json jsonb;
  criteria_json jsonb;
  questions_json jsonb;
  scopes text[];
  scope_json jsonb;
  scope_type text;
  new_model_id uuid;
  model_version_id uuid;
  level_item jsonb;
  level_ordinal integer;
  pillar_item jsonb;
  pillar_ordinal integer;
  pillar_id uuid;
  pillar_section_id uuid;
  criterion_item jsonb;
  criterion_ordinal integer;
  criterion_id uuid;
  question_item jsonb;
  question_position integer;
  question_id uuid;
  allows_not_applicable boolean;
  prompt text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model creation is not authorised'
      using errcode = '42501';
  end if;

  declared_key := btrim(coalesce(target_declared_template_key, ''));
  if declared_key = '' then
    raise exception 'declared template key is required'
      using errcode = '22023';
  end if;

  if definition is null
    or pg_catalog.jsonb_typeof(definition) is distinct from 'object' then
    raise exception 'maturity framework definition is required'
      using errcode = '22023';
  end if;

  definition_key := btrim(coalesce(definition ->> 'key', ''));
  if definition_key = '' then
    raise exception 'maturity framework definition key is required'
      using errcode = '22023';
  end if;
  if definition_key is distinct from declared_key then
    raise exception 'declared template key does not match the definition'
      using errcode = '22023';
  end if;

  display_name := btrim(coalesce(definition ->> 'name', ''));
  display_description := btrim(coalesce(definition ->> 'description', ''));
  if display_name = '' then
    raise exception 'maturity framework definition name is required'
      using errcode = '22023';
  end if;
  if display_description = '' then
    raise exception 'maturity framework definition description is required'
      using errcode = '22023';
  end if;

  scopes_json := private.maturity_definition_require_array(
    definition -> 'assessmentScopes',
    'assessmentScopes'
  );
  levels_json := private.maturity_definition_require_array(
    definition -> 'levels',
    'levels'
  );
  pillars_json := private.maturity_definition_require_array(
    definition -> 'pillars',
    'pillars'
  );

  scopes := '{}'::text[];
  for scope_json in
    select value
    from jsonb_array_elements(scopes_json)
  loop
    if pg_catalog.jsonb_typeof(scope_json) is distinct from 'string' then
      raise exception 'invalid assessment scope type'
        using errcode = '22023';
    end if;
    scope_type := btrim(scope_json #>> '{}');
    if scope_type is null or scope_type not in ('site', 'department', 'area') then
      raise exception 'invalid assessment scope type'
        using errcode = '22023';
    end if;
    if not scope_type = any(scopes) then
      scopes := array_append(scopes, scope_type);
    end if;
  end loop;

  for level_item in
    select value
    from jsonb_array_elements(levels_json)
  loop
    perform private.maturity_definition_require_object(level_item, 'level');
  end loop;

  if (
    select count(*)
    from (
      select btrim(level_row.value ->> 'name') as level_name
      from jsonb_array_elements(levels_json) as level_row(value)
    ) named_levels
  ) <> (
    select count(distinct level_name)
    from (
      select btrim(level_row.value ->> 'name') as level_name
      from jsonb_array_elements(levels_json) as level_row(value)
    ) named_levels
  ) then
    raise exception 'maturity framework definition has duplicate level names'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(levels_json)
      with ordinality as level_row(value, ordinality)
    where btrim(coalesce(level_row.value ->> 'name', '')) = ''
       or btrim(coalesce(level_row.value ->> 'colorToken', '')) = ''
       or btrim(coalesce(level_row.value ->> 'colorToken', ''))
         <> ('maturity-' || level_row.ordinality::text)
  ) then
    raise exception 'maturity framework definition has malformed level ordering'
      using errcode = '22023';
  end if;

  for pillar_item in
    select value
    from jsonb_array_elements(pillars_json)
  loop
    perform private.maturity_definition_require_object(pillar_item, 'pillar');
    if btrim(coalesce(pillar_item ->> 'name', '')) = '' then
      raise exception 'maturity framework definition has incomplete pillars'
        using errcode = '22023';
    end if;

    criteria_json := private.maturity_definition_require_array(
      pillar_item -> 'criteria',
      'criteria'
    );

    for criterion_item in
      select value
      from jsonb_array_elements(criteria_json)
    loop
      perform private.maturity_definition_require_object(criterion_item, 'criterion');
      if btrim(coalesce(criterion_item ->> 'name', '')) = '' then
        raise exception 'maturity framework definition has an incomplete criterion'
          using errcode = '22023';
      end if;

      questions_json := private.maturity_definition_require_array(
        criterion_item -> 'questions',
        'questions'
      );

      for question_item in
        select value
        from jsonb_array_elements(questions_json)
      loop
        perform private.maturity_definition_require_object(question_item, 'question');
        if btrim(coalesce(question_item ->> 'prompt', '')) = '' then
          raise exception 'maturity framework definition has an empty question prompt'
            using errcode = '22023';
        end if;
      end loop;
    end loop;
  end loop;

  new_model_id := private.create_maturity_model_draft(
    display_name,
    display_description
  );

  select model_version.id
  into model_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.model_id = new_model_id
    and model_version.version_number = 1
    and model_version.status = 'draft';

  if model_version_id is null then
    raise exception 'maturity framework draft version could not be created'
      using errcode = '55000';
  end if;

  perform private.set_maturity_model_version_assessment_scopes(
    model_version_id,
    scopes
  );

  for level_item, level_ordinal in
    select value, ordinality
    from jsonb_array_elements(levels_json) with ordinality
  loop
    perform private.add_maturity_level(
      model_version_id,
      level_ordinal::integer,
      btrim(level_item ->> 'name'),
      btrim(level_item ->> 'colorToken'),
      nullif(btrim(coalesce(level_item ->> 'description', '')), ''),
      nullif(btrim(coalesce(level_item ->> 'guidance', '')), '')
    );
  end loop;

  for pillar_item, pillar_ordinal in
    select value, ordinality
    from jsonb_array_elements(pillars_json) with ordinality
  loop
    pillar_id := private.add_maturity_pillar(
      model_version_id,
      btrim(pillar_item ->> 'name'),
      pillar_ordinal::integer,
      nullif(btrim(coalesce(pillar_item ->> 'description', '')), ''),
      1,
      nullif(btrim(coalesce(pillar_item ->> 'guidance', '')), ''),
      btrim(pillar_item ->> 'name')
    );

    select pillar_row.section_id
    into pillar_section_id
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.id = pillar_id;

    question_position := 0;

    for criterion_item, criterion_ordinal in
      select value, ordinality
      from jsonb_array_elements(pillar_item -> 'criteria') with ordinality
    loop
      criterion_id := private.add_maturity_criterion(
        pillar_id,
        btrim(criterion_item ->> 'name'),
        criterion_ordinal::integer,
        nullif(btrim(coalesce(criterion_item ->> 'description', '')), ''),
        null,
        nullif(btrim(coalesce(criterion_item ->> 'guidance', '')), ''),
        1
      );

      for question_item in
        select value
        from jsonb_array_elements(criterion_item -> 'questions')
      loop
        question_position := question_position + 1;
        prompt := btrim(question_item ->> 'prompt');
        allows_not_applicable := coalesce(
          (question_item ->> 'allowsNotApplicable')::boolean,
          true
        );
        question_id := private.add_maturity_question(
          model_version_id,
          pillar_section_id,
          'score',
          prompt,
          question_position,
          true,
          allows_not_applicable,
          null,
          null
        );
        perform private.link_criterion_question(
          criterion_id,
          question_id,
          true,
          jsonb_build_object('type', 'direct')
        );
      end loop;
    end loop;
  end loop;

  if exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.model_id = new_model_id
      and model_version.status = 'published'
  ) then
    raise exception 'maturity framework definition instantiation must not publish'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'maturity.model.draft_created_from_definition',
    new_model_id,
    'succeeded',
    jsonb_build_object(
      'declared_template_key', declared_key,
      'model_version_id', model_version_id,
      'status', 'draft'
    )
  );

  return new_model_id;
end;
$$;

create or replace function public.create_maturity_model_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_maturity_model_draft_from_definition(
    target_declared_template_key,
    target_definition
  )
$$;

alter function private.maturity_definition_require_array(jsonb, text)
  owner to lean_hub_private_owner;
alter function private.maturity_definition_require_object(jsonb, text)
  owner to lean_hub_private_owner;
alter function private.create_maturity_model_draft_from_definition(text, jsonb)
  owner to lean_hub_private_owner;

revoke all on function private.maturity_definition_require_array(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.maturity_definition_require_object(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.create_maturity_model_draft_from_definition(text, jsonb)
  from public, anon;
revoke all on function public.create_maturity_model_draft_from_definition(text, jsonb)
  from public, anon;

grant execute on function private.maturity_definition_require_array(jsonb, text)
  to lean_hub_private_owner;
grant execute on function private.maturity_definition_require_object(jsonb, text)
  to lean_hub_private_owner;
grant execute on function private.create_maturity_model_draft_from_definition(text, jsonb)
  to authenticated, lean_hub_private_owner;
grant execute on function public.create_maturity_model_draft_from_definition(text, jsonb)
  to authenticated;
