-- Draft-only structural editing for maturity frameworks.
-- Published/archived versions remain immutable. All writes stay organisation-scoped.

create or replace function private.assert_maturity_draft_authoring()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity framework structural edit is not authorised'
      using errcode = '42501';
  end if;

  return org_id;
end;
$$;

create or replace function private.next_maturity_section_question_position(
  target_organisation_id uuid,
  target_section_id uuid
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
  select coalesce(pg_catalog.max(question_row.position), 0) + 1
  into next_position
  from public.template_questions question_row
  where question_row.organisation_id = target_organisation_id
    and question_row.section_id = target_section_id;

  return next_position;
end;
$$;

create or replace function private.next_maturity_criterion_position(
  target_organisation_id uuid,
  target_pillar_id uuid
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
  select coalesce(pg_catalog.max(criterion_row.position), 0) + 1
  into next_position
  from public.maturity_criteria criterion_row
  where criterion_row.organisation_id = target_organisation_id
    and criterion_row.pillar_id = target_pillar_id;

  return next_position;
end;
$$;

create or replace function private.move_maturity_criterion(
  target_criterion_id uuid,
  target_pillar_id uuid,
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
  source_pillar_id uuid;
  source_section_id uuid;
  dest_section_id uuid;
  dest_model_version_id uuid;
  source_model_version_id uuid;
  target_model_id uuid;
  resolved_position integer;
  question_item record;
  dest_question_position integer;
begin
  select
    criterion_row.pillar_id,
    pillar_row.section_id,
    pillar_row.model_version_id,
    model_version.model_id
  into source_pillar_id, source_section_id, source_model_version_id, target_model_id
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

  if source_pillar_id is null then
    raise exception 'maturity criterion is not editable'
      using errcode = '55000';
  end if;

  select pillar_row.section_id, pillar_row.model_version_id
  into dest_section_id, dest_model_version_id
  from public.maturity_pillars pillar_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = pillar_row.organisation_id
   and model_version.id = pillar_row.model_version_id
   and model_version.status = 'draft'
  where pillar_row.organisation_id = org_id
    and pillar_row.id = target_pillar_id
  for update of pillar_row;

  if dest_section_id is null then
    raise exception 'target maturity pillar is not editable'
      using errcode = '55000';
  end if;

  if dest_model_version_id <> source_model_version_id then
    raise exception 'criterion must stay within the same draft framework version'
      using errcode = '22023';
  end if;

  resolved_position := coalesce(
    target_position,
    case
      when source_pillar_id = target_pillar_id then (
        select criterion_row.position
        from public.maturity_criteria criterion_row
        where criterion_row.organisation_id = org_id
          and criterion_row.id = target_criterion_id
      )
      else private.next_maturity_criterion_position(org_id, target_pillar_id)
    end
  );

  if exists (
    select 1
    from public.maturity_criteria criterion_row
    where criterion_row.organisation_id = org_id
      and criterion_row.pillar_id = target_pillar_id
      and criterion_row.position = resolved_position
      and criterion_row.id <> target_criterion_id
  ) then
    raise exception 'maturity criterion position is already used in the target pillar'
      using errcode = '23505';
  end if;

  update public.maturity_criteria criterion_row
  set pillar_id = target_pillar_id,
      position = resolved_position
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id;

  if source_section_id <> dest_section_id then
    dest_question_position := private.next_maturity_section_question_position(
      org_id,
      dest_section_id
    );

    for question_item in
      select
        question_row.id as question_id
      from public.maturity_criterion_questions question_link
      join public.template_questions question_row
        on question_row.organisation_id = question_link.organisation_id
       and question_row.id = question_link.question_id
      where question_link.organisation_id = org_id
        and question_link.criterion_id = target_criterion_id
      order by question_row.position, question_row.id
    loop
      update public.template_questions question_row
      set section_id = dest_section_id,
          position = dest_question_position
      where question_row.organisation_id = org_id
        and question_row.id = question_item.question_id;

      dest_question_position := dest_question_position + 1;
    end loop;
  end if;

  perform private.append_business_audit(
    org_id,
    'maturity.criterion.moved',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'criterion_id', target_criterion_id,
      'from_pillar_id', source_pillar_id,
      'to_pillar_id', target_pillar_id,
      'position', resolved_position
    )
  );

  return true;
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

  if source_section_id <> dest_section_id then
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

create or replace function private.delete_maturity_question(
  target_question_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  model_version_id uuid;
  target_model_id uuid;
begin
  select model_version.id, model_version.model_id
  into model_version_id, target_model_id
  from public.template_questions question_row
  join public.maturity_model_versions model_version
    on model_version.organisation_id = question_row.organisation_id
   and model_version.template_version_id = question_row.template_version_id
   and model_version.status = 'draft'
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  for update of question_row;

  if model_version_id is null then
    raise exception 'maturity question is not editable'
      using errcode = '55000';
  end if;

  delete from public.maturity_criterion_questions question_link
  where question_link.organisation_id = org_id
    and question_link.question_id = target_question_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id;

  perform private.append_business_audit(
    org_id,
    'maturity.question.deleted',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object('question_id', target_question_id)
  );

  return true;
end;
$$;

create or replace function private.delete_maturity_criterion(
  target_criterion_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.assert_maturity_draft_authoring();
  model_version_id uuid;
  target_model_id uuid;
  orphan_question_id uuid;
begin
  select pillar_row.model_version_id, model_version.model_id
  into model_version_id, target_model_id
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

  if model_version_id is null then
    raise exception 'maturity criterion is not editable'
      using errcode = '55000';
  end if;

  for orphan_question_id in
    select question_link.question_id
    from public.maturity_criterion_questions question_link
    where question_link.organisation_id = org_id
      and question_link.criterion_id = target_criterion_id
      and not exists (
        select 1
        from public.maturity_criterion_questions other_link
        where other_link.organisation_id = org_id
          and other_link.question_id = question_link.question_id
          and other_link.criterion_id <> target_criterion_id
      )
  loop
    delete from public.maturity_criterion_questions question_link
    where question_link.organisation_id = org_id
      and question_link.question_id = orphan_question_id;

    delete from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.id = orphan_question_id;
  end loop;

  delete from public.maturity_criterion_questions question_link
  where question_link.organisation_id = org_id
    and question_link.criterion_id = target_criterion_id;

  delete from public.maturity_criteria criterion_row
  where criterion_row.organisation_id = org_id
    and criterion_row.id = target_criterion_id;

  perform private.append_business_audit(
    org_id,
    'maturity.criterion.deleted',
    target_model_id,
    'succeeded',
    pg_catalog.jsonb_build_object('criterion_id', target_criterion_id)
  );

  return true;
end;
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
as $$
  select private.move_maturity_criterion(
    target_criterion_id,
    target_pillar_id,
    target_position
  )
$$;

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
as $$
  select private.move_maturity_question(
    target_question_id,
    target_criterion_id,
    target_position
  )
$$;

create or replace function public.delete_maturity_question(
  target_question_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.delete_maturity_question(target_question_id)
$$;

create or replace function public.delete_maturity_criterion(
  target_criterion_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.delete_maturity_criterion(target_criterion_id)
$$;

grant execute on function public.move_maturity_criterion(uuid, uuid, integer) to authenticated;
grant execute on function public.move_maturity_question(uuid, uuid, integer) to authenticated;
grant execute on function public.delete_maturity_question(uuid) to authenticated;
grant execute on function public.delete_maturity_criterion(uuid) to authenticated;

revoke all on function public.move_maturity_criterion(uuid, uuid, integer) from public, anon;
revoke all on function public.move_maturity_question(uuid, uuid, integer) from public, anon;
revoke all on function public.delete_maturity_question(uuid) from public, anon;
revoke all on function public.delete_maturity_criterion(uuid) from public, anon;

alter function private.assert_maturity_draft_authoring()
  owner to lean_hub_private_owner;
alter function private.next_maturity_section_question_position(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.next_maturity_criterion_position(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.move_maturity_criterion(uuid, uuid, integer)
  owner to lean_hub_private_owner;
alter function private.move_maturity_question(uuid, uuid, integer)
  owner to lean_hub_private_owner;
alter function private.delete_maturity_question(uuid)
  owner to lean_hub_private_owner;
alter function private.delete_maturity_criterion(uuid)
  owner to lean_hub_private_owner;
