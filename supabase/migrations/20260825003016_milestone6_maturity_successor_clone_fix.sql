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

  new_template_version_id := private.clone_published_template_version(template_id);

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
