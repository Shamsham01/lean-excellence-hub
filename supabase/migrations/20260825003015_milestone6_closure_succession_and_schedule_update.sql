-- Clone published template versions without experience-type route guards (domain RPCs call this).
create or replace function private.clone_published_template_version(
  target_template_id uuid
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
  source_version_id uuid;
  source_version_number integer;
  new_version_id uuid;
  section_map jsonb := '{}'::jsonb;
  section_row record;
  new_section_id uuid;
  question_row record;
begin
  select template_version.id, template_version.version_number
  into source_version_id, source_version_number
  from public.template_versions template_version
  where template_version.organisation_id = org_id
    and template_version.template_id = target_template_id
    and template_version.status = 'published'
  order by template_version.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'template has no published version for successor creation'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.template_versions template_version
    where template_version.organisation_id = org_id
      and template_version.template_id = target_template_id
      and template_version.status = 'draft'
  ) then
    raise exception 'template already has a draft version'
      using errcode = '55000';
  end if;

  insert into public.template_versions (
    organisation_id,
    template_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_template_id,
    source_version_number + 1,
    'draft',
    actor_membership_id
  )
  returning id into new_version_id;

  for section_row in
    select section_item.*
    from public.template_sections section_item
    where section_item.organisation_id = org_id
      and section_item.template_version_id = source_version_id
    order by section_item.position
  loop
    insert into public.template_sections (
      organisation_id,
      template_version_id,
      title,
      position
    )
    values (
      org_id,
      new_version_id,
      section_row.title,
      section_row.position
    )
    returning id into new_section_id;

    section_map := section_map || jsonb_build_object(section_row.id::text, new_section_id);
  end loop;

  for question_row in
    select question_item.*
    from public.template_questions question_item
    where question_item.organisation_id = org_id
      and question_item.template_version_id = source_version_id
    order by question_item.section_id, question_item.position
  loop
    insert into public.template_questions (
      organisation_id,
      template_version_id,
      section_id,
      question_type,
      prompt,
      position,
      is_required,
      allows_not_applicable,
      help_text,
      options
    )
    values (
      org_id,
      new_version_id,
      (section_map ->> question_row.section_id::text)::uuid,
      question_row.question_type,
      question_row.prompt,
      question_row.position,
      question_row.is_required,
      question_row.allows_not_applicable,
      question_row.help_text,
      question_row.options
    );
  end loop;

  return new_version_id;
end;
$$;

create or replace function private.create_template_successor_version_internal(
  target_template_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if private.is_five_s_audit_template(target_template_id) then
    raise exception '5S audit template successor must use 5S operations'
      using errcode = '42501';
  end if;

  if private.is_gemba_walk_template(target_template_id) then
    raise exception 'gemba walk template successor must use gemba operations'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template(target_template_id) then
    raise exception 'maturity assessment template successor must use maturity operations'
      using errcode = '42501';
  end if;

  return private.clone_published_template_version(target_template_id);
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

create or replace function private.create_gemba_definition_successor_version(
  target_definition_id uuid
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
  new_definition_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba definition successor creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_item.template_id
  into template_id
  from public.gemba_definitions definition_item
  where definition_item.organisation_id = org_id
    and definition_item.id = target_definition_id;

  if template_id is null then
    raise exception 'gemba definition was not found'
      using errcode = '23503';
  end if;

  select version_item.id, version_item.version_number
  into source_version_id, source_version_number
  from public.gemba_definition_versions version_item
  where version_item.organisation_id = org_id
    and version_item.definition_id = target_definition_id
    and version_item.status = 'published'
  order by version_item.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'gemba definition has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.gemba_definition_versions version_item
    where version_item.organisation_id = org_id
      and version_item.definition_id = target_definition_id
      and version_item.status = 'draft'
  ) then
    raise exception 'gemba definition already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.clone_published_template_version(template_id);

  insert into public.gemba_definition_versions (
    organisation_id,
    definition_id,
    template_version_id,
    version_number,
    status,
    expected_duration_minutes,
    created_by_membership_id
  )
  select
    org_id,
    target_definition_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.expected_duration_minutes,
    actor_membership_id
  from public.gemba_definition_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_definition_version_id;

  perform private.append_business_audit(
    org_id,
    'gemba.definition.successor_created',
    target_definition_id,
    'succeeded',
    jsonb_build_object(
      'definition_id', target_definition_id,
      'definition_version_id', new_definition_version_id
    )
  );

  return new_definition_version_id;
end;
$$;

create or replace function private.update_schedule_definition(
  target_schedule_definition_id uuid,
  target_title text,
  target_unit_id uuid,
  target_owner_membership_id uuid,
  target_recurrence jsonb,
  target_start_date date,
  target_is_all_day boolean default false,
  target_local_time time default null,
  target_end_date date default null,
  target_description text default null,
  target_participant_membership_ids uuid[] default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_timezone text;
  participant_id uuid;
begin
  if org_id is null
    or not private.can_manage_schedule_definition(org_id, target_schedule_definition_id) then
    raise exception 'schedule update is not authorised'
      using errcode = '42501';
  end if;

  if not private.validate_schedule_recurrence(target_recurrence) then
    raise exception 'schedule recurrence is invalid'
      using errcode = '22023';
  end if;

  if target_is_all_day and target_local_time is not null then
    raise exception 'all-day schedules cannot include local time'
      using errcode = '22023';
  end if;

  if not target_is_all_day and target_local_time is null then
    raise exception 'timed schedules require local time'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = org_id
      and schedule_row.id = target_schedule_definition_id
      and schedule_row.status = 'active'
  ) then
    raise exception 'schedule definition is not active'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = target_owner_membership_id
      and membership_row.status = 'active'
  ) then
    raise exception 'schedule owner membership is invalid'
      using errcode = '23503';
  end if;

  update public.schedule_definitions schedule_row
  set title = target_title,
      description = target_description,
      unit_id = target_unit_id,
      owner_membership_id = target_owner_membership_id,
      is_all_day = target_is_all_day,
      local_time = case when target_is_all_day then null else target_local_time end,
      recurrence = target_recurrence,
      start_date = target_start_date,
      end_date = target_end_date,
      updated_at = statement_timestamp()
  where schedule_row.organisation_id = org_id
    and schedule_row.id = target_schedule_definition_id
    and schedule_row.status = 'active';

  select schedule_row.timezone
  into schedule_timezone
  from public.schedule_definitions schedule_row
  where schedule_row.organisation_id = org_id
    and schedule_row.id = target_schedule_definition_id;

  update public.schedule_occurrences occurrence_row
  set lifecycle_status = 'cancelled'
  where occurrence_row.organisation_id = org_id
    and occurrence_row.schedule_definition_id = target_schedule_definition_id
    and occurrence_row.lifecycle_status = 'open'
    and occurrence_row.planned_local_date >= timezone(schedule_timezone, statement_timestamp())::date;

  if target_participant_membership_ids is not null then
    delete from public.schedule_participants participant_row
    where participant_row.organisation_id = org_id
      and participant_row.schedule_definition_id = target_schedule_definition_id;

    foreach participant_id in array target_participant_membership_ids loop
      if exists (
        select 1
        from public.organisation_memberships membership_row
        where membership_row.organisation_id = org_id
          and membership_row.id = participant_id
          and membership_row.status = 'active'
      ) then
        insert into public.schedule_participants (
          organisation_id,
          schedule_definition_id,
          membership_id
        )
        values (org_id, target_schedule_definition_id, participant_id)
        on conflict (organisation_id, schedule_definition_id, membership_id) do nothing;
      end if;
    end loop;
  end if;

  perform private.ensure_schedule_occurrences(target_schedule_definition_id, 90);

  perform private.append_business_audit(
    org_id,
    'schedule.updated',
    target_schedule_definition_id,
    'succeeded',
    jsonb_build_object('schedule_definition_id', target_schedule_definition_id)
  );

  return true;
end;
$$;

create or replace function public.create_five_s_standard_successor_version(target_standard_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_five_s_standard_successor_version(target_standard_id) $$;

create or replace function public.create_gemba_definition_successor_version(target_definition_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_gemba_definition_successor_version(target_definition_id) $$;

create or replace function public.update_schedule_definition(
  target_schedule_definition_id uuid,
  target_title text,
  target_unit_id uuid,
  target_owner_membership_id uuid,
  target_recurrence jsonb,
  target_start_date date,
  target_is_all_day boolean default false,
  target_local_time time default null,
  target_end_date date default null,
  target_description text default null,
  target_participant_membership_ids uuid[] default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  select private.update_schedule_definition(
    target_schedule_definition_id,
    target_title,
    target_unit_id,
    target_owner_membership_id,
    target_recurrence,
    target_start_date,
    target_is_all_day,
    target_local_time,
    target_end_date,
    target_description,
    target_participant_membership_ids
  )
$$;

grant execute on function public.create_five_s_standard_successor_version(uuid) to authenticated;
grant execute on function public.create_gemba_definition_successor_version(uuid) to authenticated;
grant execute on function public.update_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) to authenticated;

alter function private.clone_published_template_version(uuid)
  owner to lean_hub_private_owner;
alter function private.create_five_s_standard_successor_version(uuid)
  owner to lean_hub_private_owner;
alter function private.create_gemba_definition_successor_version(uuid)
  owner to lean_hub_private_owner;
alter function private.update_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) owner to lean_hub_private_owner;

revoke all on function public.create_five_s_standard_successor_version(uuid) from public, anon;
revoke all on function public.create_gemba_definition_successor_version(uuid) from public, anon;
revoke all on function public.update_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) from public, anon;
