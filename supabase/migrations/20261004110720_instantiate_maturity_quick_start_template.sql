-- MAT-TEMPLATE-01: atomic Quick Start instantiation for Maturity frameworks.
-- Built-in template content lives in application code. This RPC materialises a
-- server-resolved definition into an organisation-owned DRAFT only.
-- Do not apply this migration to hosted Supabase from this change.

create or replace function private.instantiate_maturity_quick_start_template(
  target_template_key text,
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
  definition_key text;
  display_name text;
  display_description text;
  scopes text[];
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

  if btrim(coalesce(target_template_key, '')) = '' then
    raise exception 'maturity Quick Start template key is required'
      using errcode = '22023';
  end if;

  if definition is null or pg_catalog.jsonb_typeof(definition) <> 'object' then
    raise exception 'maturity Quick Start definition is required'
      using errcode = '22023';
  end if;

  definition_key := btrim(coalesce(definition ->> 'key', ''));
  if definition_key = '' or definition_key <> btrim(target_template_key) then
    raise exception 'maturity Quick Start template key does not match the definition'
      using errcode = '22023';
  end if;

  display_name := btrim(coalesce(definition ->> 'name', ''));
  display_description := btrim(coalesce(definition ->> 'description', ''));
  if display_name = '' then
    raise exception 'maturity Quick Start template name is required'
      using errcode = '22023';
  end if;
  if display_description = '' then
    raise exception 'maturity Quick Start template description is required'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(definition -> 'assessmentScopes') <> 'array'
    or jsonb_array_length(definition -> 'assessmentScopes') < 1 then
    raise exception 'maturity Quick Start template requires assessment scopes'
      using errcode = '22023';
  end if;

  scopes := '{}'::text[];
  for scope_type in
    select btrim(value #>> '{}')
    from jsonb_array_elements(definition -> 'assessmentScopes')
  loop
    if scope_type is null or scope_type not in ('site', 'department', 'area') then
      raise exception 'invalid assessment scope type'
        using errcode = '22023';
    end if;
    if not scope_type = any(scopes) then
      scopes := array_append(scopes, scope_type);
    end if;
  end loop;

  if pg_catalog.jsonb_typeof(definition -> 'levels') <> 'array'
    or jsonb_array_length(definition -> 'levels') < 1 then
    raise exception 'maturity Quick Start template requires maturity levels'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from (
      select btrim(level_row.value ->> 'name') as level_name
      from jsonb_array_elements(definition -> 'levels') as level_row(value)
    ) named_levels
  ) <> (
    select count(distinct level_name)
    from (
      select btrim(level_row.value ->> 'name') as level_name
      from jsonb_array_elements(definition -> 'levels') as level_row(value)
    ) named_levels
  ) then
    raise exception 'maturity Quick Start template has duplicate level names'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(definition -> 'pillars') <> 'array'
    or jsonb_array_length(definition -> 'pillars') < 1 then
    raise exception 'maturity Quick Start template requires pillars'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(definition -> 'levels') with ordinality as level_row(value, ordinality)
    where btrim(coalesce(level_row.value ->> 'name', '')) = ''
       or btrim(coalesce(level_row.value ->> 'colorToken', '')) = ''
       or btrim(coalesce(level_row.value ->> 'colorToken', '')) <> ('maturity-' || level_row.ordinality::text)
  ) then
    raise exception 'maturity Quick Start template has malformed level ordering'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(definition -> 'pillars') as pillar_row(value)
    where btrim(coalesce(pillar_row.value ->> 'name', '')) = ''
       or pg_catalog.jsonb_typeof(pillar_row.value -> 'criteria') <> 'array'
       or jsonb_array_length(pillar_row.value -> 'criteria') < 1
  ) then
    raise exception 'maturity Quick Start template has incomplete pillars'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(definition -> 'pillars') as pillar_row(value),
         jsonb_array_elements(pillar_row.value -> 'criteria') as criterion_row(value)
    where btrim(coalesce(criterion_row.value ->> 'name', '')) = ''
       or pg_catalog.jsonb_typeof(criterion_row.value -> 'questions') <> 'array'
       or jsonb_array_length(criterion_row.value -> 'questions') < 1
  ) then
    raise exception 'maturity Quick Start template has a criterion without scored questions'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(definition -> 'pillars') as pillar_row(value),
         jsonb_array_elements(pillar_row.value -> 'criteria') as criterion_row(value),
         jsonb_array_elements(criterion_row.value -> 'questions') as question_row(value)
    where btrim(coalesce(question_row.value ->> 'prompt', '')) = ''
  ) then
    raise exception 'maturity Quick Start template has an empty question prompt'
      using errcode = '22023';
  end if;

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
    raise exception 'maturity Quick Start draft version could not be created'
      using errcode = '55000';
  end if;

  perform private.set_maturity_model_version_assessment_scopes(
    model_version_id,
    scopes
  );

  for level_item, level_ordinal in
    select value, ordinality
    from jsonb_array_elements(definition -> 'levels') with ordinality
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
    from jsonb_array_elements(definition -> 'pillars') with ordinality
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
        allows_not_applicable := coalesce((question_item ->> 'allowsNotApplicable')::boolean, true);
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
    raise exception 'maturity Quick Start instantiation must not publish'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'maturity.model.quick_start_instantiated',
    new_model_id,
    'succeeded',
    jsonb_build_object(
      'template_key', definition_key,
      'model_version_id', model_version_id,
      'status', 'draft'
    )
  );

  return new_model_id;
end;
$$;

create or replace function public.instantiate_maturity_quick_start_template(
  target_template_key text,
  target_definition jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.instantiate_maturity_quick_start_template(
    target_template_key,
    target_definition
  )
$$;

alter function private.instantiate_maturity_quick_start_template(text, jsonb)
  owner to lean_hub_private_owner;

revoke all on function private.instantiate_maturity_quick_start_template(text, jsonb)
  from public, anon;
revoke all on function public.instantiate_maturity_quick_start_template(text, jsonb)
  from public, anon;

grant execute on function private.instantiate_maturity_quick_start_template(text, jsonb)
  to authenticated, lean_hub_private_owner;
grant execute on function public.instantiate_maturity_quick_start_template(text, jsonb)
  to authenticated;
