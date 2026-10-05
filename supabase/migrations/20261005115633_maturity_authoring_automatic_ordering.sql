-- MAT-UX-006: authoritative Maturity authoring order.
-- Customers no longer supply sibling Position values. Create appends, parent
-- moves append, and sibling reorder is a tenant-scoped draft-only RPC.
--
-- Do not apply this migration to hosted Supabase from this change.

create or replace function private.next_maturity_pillar_position(
  target_organisation_id uuid,
  target_model_version_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  next_position integer;
begin
  select coalesce(pg_catalog.max(pillar_row.position), 0) + 1
    into next_position
  from public.maturity_pillars pillar_row
  where pillar_row.organisation_id = target_organisation_id
    and pillar_row.model_version_id = target_model_version_id;

  return next_position;
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
  resolved_position integer;
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
    and model_version.status = 'draft'
  for update of model_version;

  if template_version_id is null then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.maturity_pillars pillar_row
  where pillar_row.organisation_id = org_id
    and pillar_row.model_version_id = target_model_version_id
  for update of pillar_row;

  resolved_position := coalesce(
    target_position,
    private.next_maturity_pillar_position(org_id, target_model_version_id)
  );

  new_section_id := private.add_template_section_internal(
    template_version_id,
    coalesce(target_section_title, target_name),
    resolved_position
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
    resolved_position,
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
  resolved_position integer;
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
    and model_version.status = 'draft'
  for update of model_version;

  if template_version_id is null then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
  for update of section_row;

  resolved_position := coalesce(
    target_position,
    private.next_maturity_section_question_position(org_id, target_section_id)
  );

  return private.add_template_question_internal(
    template_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    resolved_position,
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
  resolved_position integer;
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
    and pillar_row.id = target_pillar_id
  for update of pillar_row;

  if model_version_id is null then
    raise exception 'maturity pillar is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.maturity_criteria criterion_row
  where criterion_row.organisation_id = org_id
    and criterion_row.pillar_id = target_pillar_id
  for update of criterion_row;

  resolved_position := coalesce(
    target_position,
    private.next_maturity_criterion_position(org_id, target_pillar_id)
  );

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
    resolved_position,
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

create or replace function private.move_maturity_question(
  target_question_id uuid,
  target_criterion_id uuid,
  target_position integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  source_section_id uuid;
  dest_section_id uuid;
  dest_model_version_id uuid;
  source_model_version_id uuid;
  target_model_id uuid;
  source_criterion_id uuid;
  contributes_to_score boolean;
  scoring_metadata jsonb;
  resolved_position integer;
  reparenting boolean;
begin
  select
    question_row.section_id,
    model_version.id,
    model_version.model_id,
    question_link.criterion_id,
    question_link.contributes_to_score,
    question_link.scoring_metadata
  into
    source_section_id,
    source_model_version_id,
    target_model_id,
    source_criterion_id,
    contributes_to_score,
    scoring_metadata
  from public.template_questions question_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = question_row.organisation_id
   and model_version.template_version_id = question_row.template_version_id
   and model_version.status = 'draft'
  left join public.maturity_criterion_questions question_link
    on question_link.organisation_id = question_row.organisation_id
   and question_link.question_id = question_row.id
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  order by question_link.created_at
  limit 1
  for update of question_row;

  if source_model_version_id is null then
    raise exception 'maturity question is not editable'
      using errcode = '55000';
  end if;

  select pillar_row.section_id, pillar_row.model_version_id
  into dest_section_id, dest_model_version_id
  from public.maturity_criteria criterion_row
  join public.maturity_pillars pillar_row
    on pillar_row.organisation_id = criterion_row.organisation_id
   and pillar_row.id = criterion_row.pillar_id
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id
  for update of criterion_row;

  if dest_section_id is null then
    raise exception 'target maturity criterion is not editable'
      using errcode = '55000';
  end if;

  if dest_model_version_id <> source_model_version_id then
    raise exception 'question must stay within the same draft framework version'
      using errcode = '22023';
  end if;

  reparenting := source_criterion_id is distinct from target_criterion_id
    or source_section_id <> dest_section_id;

  if reparenting then
    perform 1
    from public.template_sections section_row
    where section_row.organisation_id = org_id
      and section_row.id = dest_section_id
    for update of section_row;

    resolved_position := coalesce(
      target_position,
      private.next_maturity_section_question_position(org_id, dest_section_id)
    );

    if exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.section_id = dest_section_id
        and question_row.position = resolved_position
        and question_row.id <> target_question_id
    ) then
      resolved_position := private.next_maturity_section_question_position(
        org_id,
        dest_section_id
      );
    end if;

    update public.template_questions question_row
    set section_id = dest_section_id,
        position = resolved_position
    where question_row.organisation_id = org_id
      and question_row.id = target_question_id;
  elsif target_position is not null then
    update public.template_questions question_row
    set position = target_position
    where question_row.organisation_id = org_id
      and question_row.id = target_question_id
      and not exists (
        select 1
        from public.template_questions other_question
        where other_question.organisation_id = org_id
          and other_question.section_id = source_section_id
          and other_question.position = target_position
          and other_question.id <> target_question_id
      );

    if not found then
      raise exception 'maturity question position is already used in the pillar section'
        using errcode = '23505';
    end if;
  end if;

  if source_criterion_id is distinct from target_criterion_id then
    delete from public.maturity_criterion_questions question_link
    where question_link.organisation_id = org_id
      and question_link.question_id = target_question_id;

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
      coalesce(contributes_to_score, true),
      coalesce(scoring_metadata, '{"type":"direct"}'::jsonb)
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'maturity.question.moved',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'question_id', target_question_id,
      'from_criterion_id', source_criterion_id,
      'to_criterion_id', target_criterion_id
    )
  );

  return true;
end;
$$;

create or replace function private.reorder_maturity_pillar(
  target_pillar_id uuid,
  target_direction text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  item_version_id uuid;
  item_section_id uuid;
  item_template_version_id uuid;
  target_model_id uuid;
  item_position integer;
  neighbor_id uuid;
  neighbor_section_id uuid;
  neighbor_position integer;
  staged_position integer;
begin
  if target_direction not in ('up', 'down') then
    raise exception 'maturity reorder direction is invalid'
      using errcode = '22023';
  end if;

  select
    pillar_row.model_version_id,
    pillar_row.section_id,
    pillar_row.position,
    model_version.template_version_id,
    model_version.model_id
  into
    item_version_id,
    item_section_id,
    item_position,
    item_template_version_id,
    target_model_id
  from public.maturity_pillars pillar_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id
  for update of pillar_row, model_version;

  if item_version_id is null then
    raise exception 'maturity pillar is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.maturity_pillars pillar_row
  where pillar_row.organisation_id = org_id
    and pillar_row.model_version_id = item_version_id
  for update of pillar_row;

  if target_direction = 'up' then
    select pillar_row.id, pillar_row.section_id, pillar_row.position
    into neighbor_id, neighbor_section_id, neighbor_position
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = item_version_id
      and (
        pillar_row.position < item_position
        or (
          pillar_row.position = item_position
          and pillar_row.id < target_pillar_id
        )
      )
    order by pillar_row.position desc, pillar_row.id desc
    limit 1;
  else
    select pillar_row.id, pillar_row.section_id, pillar_row.position
    into neighbor_id, neighbor_section_id, neighbor_position
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = item_version_id
      and (
        pillar_row.position > item_position
        or (
          pillar_row.position = item_position
          and pillar_row.id > target_pillar_id
        )
      )
    order by pillar_row.position asc, pillar_row.id asc
    limit 1;
  end if;

  if neighbor_id is null then
    raise exception 'maturity pillar cannot move further in that direction'
      using errcode = '22023';
  end if;

  select coalesce(pg_catalog.max(position_candidate.position_value), 0) + 1
    into staged_position
  from (
    select pg_catalog.max(pillar_row.position) as position_value
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = item_version_id
    union all
    select pg_catalog.max(section_row.position)
    from public.template_sections section_row
    where section_row.organisation_id = org_id
      and section_row.template_version_id = item_template_version_id
  ) as position_candidate;

  update public.maturity_pillars pillar_row
  set position = staged_position
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id;

  update public.template_sections section_row
  set position = staged_position
  where section_row.organisation_id = org_id
    and section_row.id = item_section_id;

  update public.maturity_pillars pillar_row
  set position = item_position
  where pillar_row.organisation_id = org_id
    and pillar_row.id = neighbor_id;

  update public.template_sections section_row
  set position = item_position
  where section_row.organisation_id = org_id
    and section_row.id = neighbor_section_id;

  update public.maturity_pillars pillar_row
  set position = neighbor_position
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id;

  update public.template_sections section_row
  set position = neighbor_position
  where section_row.organisation_id = org_id
    and section_row.id = item_section_id;

  perform private.append_business_audit(
    org_id,
    'maturity.pillar.reordered',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'pillar_id', target_pillar_id,
      'direction', target_direction,
      'from_position', item_position,
      'to_position', neighbor_position
    )
  );

  return true;
end;
$$;

create or replace function private.reorder_maturity_criterion(
  target_criterion_id uuid,
  target_direction text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  item_pillar_id uuid;
  item_version_id uuid;
  target_model_id uuid;
  item_position integer;
  neighbor_id uuid;
  neighbor_position integer;
  staged_position integer;
begin
  if target_direction not in ('up', 'down') then
    raise exception 'maturity reorder direction is invalid'
      using errcode = '22023';
  end if;

  select
    criterion_row.pillar_id,
    criterion_row.position,
    pillar_row.model_version_id,
    model_version.model_id
  into item_pillar_id, item_position, item_version_id, target_model_id
  from public.maturity_criteria criterion_row
  join public.maturity_pillars pillar_row
    on pillar_row.organisation_id = criterion_row.organisation_id
   and pillar_row.id = criterion_row.pillar_id
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id
  for update of criterion_row, pillar_row;

  if item_pillar_id is null then
    raise exception 'maturity criterion is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.maturity_criteria criterion_row
  where criterion_row.organisation_id = org_id
    and criterion_row.pillar_id = item_pillar_id
  for update of criterion_row;

  if target_direction = 'up' then
    select criterion_row.id, criterion_row.position
    into neighbor_id, neighbor_position
    from public.maturity_criteria criterion_row
    where criterion_row.organisation_id = org_id
      and criterion_row.pillar_id = item_pillar_id
      and (
        criterion_row.position < item_position
        or (
          criterion_row.position = item_position
          and criterion_row.id < target_criterion_id
        )
      )
    order by criterion_row.position desc, criterion_row.id desc
    limit 1;
  else
    select criterion_row.id, criterion_row.position
    into neighbor_id, neighbor_position
    from public.maturity_criteria criterion_row
    where criterion_row.organisation_id = org_id
      and criterion_row.pillar_id = item_pillar_id
      and (
        criterion_row.position > item_position
        or (
          criterion_row.position = item_position
          and criterion_row.id > target_criterion_id
        )
      )
    order by criterion_row.position asc, criterion_row.id asc
    limit 1;
  end if;

  if neighbor_id is null then
    raise exception 'maturity criterion cannot move further in that direction'
      using errcode = '22023';
  end if;

  staged_position := private.next_maturity_criterion_position(org_id, item_pillar_id);

  update public.maturity_criteria criterion_row
  set position = staged_position
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id;

  update public.maturity_criteria criterion_row
  set position = item_position
  where criterion_row.organisation_id = org_id
    and criterion_row.id = neighbor_id;

  update public.maturity_criteria criterion_row
  set position = neighbor_position
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id;

  perform private.append_business_audit(
    org_id,
    'maturity.criterion.reordered',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'criterion_id', target_criterion_id,
      'direction', target_direction,
      'from_position', item_position,
      'to_position', neighbor_position
    )
  );

  return true;
end;
$$;

create or replace function private.reorder_maturity_question(
  target_question_id uuid,
  target_direction text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  item_section_id uuid;
  item_criterion_id uuid;
  target_model_id uuid;
  item_position integer;
  neighbor_id uuid;
  neighbor_position integer;
  staged_position integer;
begin
  if target_direction not in ('up', 'down') then
    raise exception 'maturity reorder direction is invalid'
      using errcode = '22023';
  end if;

  select
    question_row.section_id,
    question_row.position,
    question_link.criterion_id,
    model_version.model_id
  into item_section_id, item_position, item_criterion_id, target_model_id
  from public.template_questions question_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = question_row.organisation_id
   and model_version.template_version_id = question_row.template_version_id
   and model_version.status = 'draft'
  join public.maturity_criterion_questions question_link
    on question_link.organisation_id = question_row.organisation_id
   and question_link.question_id = question_row.id
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  order by question_link.created_at
  limit 1
  for update of question_row;

  if item_section_id is null or item_criterion_id is null then
    raise exception 'maturity question is not editable'
      using errcode = '55000';
  end if;

  perform 1
  from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.section_id = item_section_id
  for update of question_row;

  if target_direction = 'up' then
    select question_row.id, question_row.position
    into neighbor_id, neighbor_position
    from public.template_questions question_row
    join public.maturity_criterion_questions question_link
      on question_link.organisation_id = question_row.organisation_id
     and question_link.question_id = question_row.id
     and question_link.criterion_id = item_criterion_id
    where question_row.organisation_id = org_id
      and question_row.section_id = item_section_id
      and question_row.id <> target_question_id
      and (
        question_row.position < item_position
        or (
          question_row.position = item_position
          and question_row.id < target_question_id
        )
      )
    order by question_row.position desc, question_row.id desc
    limit 1;
  else
    select question_row.id, question_row.position
    into neighbor_id, neighbor_position
    from public.template_questions question_row
    join public.maturity_criterion_questions question_link
      on question_link.organisation_id = question_row.organisation_id
     and question_link.question_id = question_row.id
     and question_link.criterion_id = item_criterion_id
    where question_row.organisation_id = org_id
      and question_row.section_id = item_section_id
      and question_row.id <> target_question_id
      and (
        question_row.position > item_position
        or (
          question_row.position = item_position
          and question_row.id > target_question_id
        )
      )
    order by question_row.position asc, question_row.id asc
    limit 1;
  end if;

  if neighbor_id is null then
    raise exception 'maturity question cannot move further in that direction'
      using errcode = '22023';
  end if;

  staged_position := private.next_maturity_section_question_position(
    org_id,
    item_section_id
  );

  update public.template_questions question_row
  set position = staged_position
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id;

  update public.template_questions question_row
  set position = item_position
  where question_row.organisation_id = org_id
    and question_row.id = neighbor_id;

  update public.template_questions question_row
  set position = neighbor_position
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id;

  perform private.append_business_audit(
    org_id,
    'maturity.question.reordered',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'question_id', target_question_id,
      'direction', target_direction,
      'from_position', item_position,
      'to_position', neighbor_position
    )
  );

  return true;
end;
$$;

-- Legacy public authoring RPC signatures still include target_position for
-- compatibility with existing generated clients. From MAT-UX-006 onward,
-- position is deliberately ignored by create/update/move operations. Ordering
-- changes are only available through the dedicated reorder RPCs.

create or replace function private.update_maturity_pillar(
  target_pillar_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_guidance text default null,
  target_weight numeric default 1
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  target_section_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity pillar update is not authorised'
      using errcode = '42501';
  end if;

  update public.maturity_pillars pillar_row
  set name = target_name,
      description = target_description,
      guidance = target_guidance,
      weight = target_weight
  from public.maturity_model_versions model_version
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id
    and model_version.organisation_id = pillar_row.organisation_id
    and model_version.id = pillar_row.model_version_id
    and model_version.status = 'draft'
  returning pillar_row.section_id into target_section_id;

  if target_section_id is null then
    raise exception 'maturity pillar is not editable'
      using errcode = '55000';
  end if;

  update public.template_sections section_row
  set title = target_name
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id;

  return true;
end;
$;

create or replace function private.update_maturity_criterion(
  target_criterion_id uuid,
  target_name text,
  target_position integer,
  target_description text default null,
  target_expected_evidence text default null,
  target_guidance text default null,
  target_weight numeric default 1
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity criterion update is not authorised'
      using errcode = '42501';
  end if;

  update public.maturity_criteria criterion_row
  set name = target_name,
      description = target_description,
      expected_evidence = target_expected_evidence,
      guidance = target_guidance,
      weight = target_weight
  from public.maturity_pillars pillar_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id
    and pillar_row.organisation_id = criterion_row.organisation_id
    and pillar_row.id = criterion_row.pillar_id;

  if not found then
    raise exception 'maturity criterion is not editable'
      using errcode = '55000';
  end if;

  return true;
end;
$;

create or replace function private.update_maturity_question(
  target_question_id uuid,
  target_prompt text,
  target_position integer,
  target_help_text text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity question update is not authorised'
      using errcode = '42501';
  end if;

  update public.template_questions question_row
  set prompt = target_prompt,
      help_text = target_help_text
  from public.template_versions template_version
  join public.maturity_model_versions model_version
    on model_version.organisation_id = template_version.organisation_id
   and model_version.template_version_id = template_version.id
   and model_version.status = 'draft'
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
    and template_version.organisation_id = question_row.organisation_id
    and template_version.id = question_row.template_version_id;

  if not found then
    raise exception 'maturity question is not editable'
      using errcode = '55000';
  end if;

  return true;
end;
$;

drop function if exists public.add_maturity_pillar(uuid, text, integer, text, numeric, text, text);
drop function if exists public.add_maturity_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb);
drop function if exists public.add_maturity_criterion(uuid, text, integer, text, text, text, numeric);

create function public.add_maturity_pillar(
  target_model_version_id uuid,
  target_name text,
  target_position integer default null,
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
    null,
    target_description,
    target_weight,
    target_guidance,
    target_section_title
  )
$$;

create function public.add_maturity_question(
  target_model_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer default null,
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
    null,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  )
$$;

create function public.add_maturity_criterion(
  target_pillar_id uuid,
  target_name text,
  target_position integer default null,
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
    null,
    target_description,
    target_expected_evidence,
    target_guidance,
    target_weight
  )
$$;

create or replace function public.move_maturity_criterion(
  target_criterion_id uuid,
  target_pillar_id uuid,
  target_position integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $
  select private.move_maturity_criterion(
    target_criterion_id,
    target_pillar_id,
    null
  )
$;

create or replace function public.move_maturity_question(
  target_question_id uuid,
  target_criterion_id uuid,
  target_position integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $
  select private.move_maturity_question(
    target_question_id,
    target_criterion_id,
    null
  )
$;

create or replace function public.reorder_maturity_pillar(
  target_pillar_id uuid,
  target_direction text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reorder_maturity_pillar(target_pillar_id, target_direction)
$$;

create or replace function public.reorder_maturity_criterion(
  target_criterion_id uuid,
  target_direction text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reorder_maturity_criterion(
    target_criterion_id,
    target_direction
  )
$$;

create or replace function public.reorder_maturity_question(
  target_question_id uuid,
  target_direction text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reorder_maturity_question(
    target_question_id,
    target_direction
  )
$$;

grant execute on function public.add_maturity_pillar(
  uuid, text, integer, text, numeric, text, text
) to authenticated;
grant execute on function public.add_maturity_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) to authenticated;
grant execute on function public.add_maturity_criterion(
  uuid, text, integer, text, text, text, numeric
) to authenticated;
grant execute on function public.reorder_maturity_pillar(uuid, text) to authenticated;
grant execute on function public.reorder_maturity_criterion(uuid, text) to authenticated;
grant execute on function public.reorder_maturity_question(uuid, text) to authenticated;

revoke all on function public.add_maturity_pillar(
  uuid, text, integer, text, numeric, text, text
) from public, anon;
revoke all on function public.add_maturity_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) from public, anon;
revoke all on function public.add_maturity_criterion(
  uuid, text, integer, text, text, text, numeric
) from public, anon;
revoke all on function public.reorder_maturity_pillar(uuid, text) from public, anon;
revoke all on function public.reorder_maturity_criterion(uuid, text) from public, anon;
revoke all on function public.reorder_maturity_question(uuid, text) from public, anon;

alter function private.next_maturity_pillar_position(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.add_maturity_pillar(uuid, text, integer, text, numeric, text, text)
  owner to lean_hub_private_owner;
alter function private.add_maturity_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.add_maturity_criterion(uuid, text, integer, text, text, text, numeric)
  owner to lean_hub_private_owner;
alter function private.move_maturity_question(uuid, uuid, integer)
  owner to lean_hub_private_owner;
alter function private.reorder_maturity_pillar(uuid, text)
  owner to lean_hub_private_owner;
alter function private.reorder_maturity_criterion(uuid, text)
  owner to lean_hub_private_owner;
alter function private.reorder_maturity_question(uuid, text)
  owner to lean_hub_private_owner;
