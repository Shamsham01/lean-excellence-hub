create or replace function private.is_maturity_assessment_template_version(
  target_template_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.template_versions template_version
    join public.templates template_row
      on template_row.organisation_id = template_version.organisation_id
     and template_row.id = template_version.template_id
    where template_version.id = target_template_version_id
      and template_row.experience_type = 'maturity_assessment'
  )
$$;

create or replace function private.is_maturity_assessment_template(
  target_template_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.templates template_row
    where template_row.id = target_template_id
      and template_row.experience_type = 'maturity_assessment'
  )
$$;

create or replace function private.add_template_section_internal(
  target_template_version_id uuid,
  target_title text,
  target_position integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  new_section_id uuid;
begin
  if not exists (
    select 1
    from public.template_versions template_version
    where template_version.organisation_id = org_id
      and template_version.id = target_template_version_id
      and template_version.status = 'draft'
  ) then
    raise exception 'template version is not editable'
      using errcode = '55000';
  end if;

  insert into public.template_sections (
    organisation_id,
    template_version_id,
    title,
    position
  )
  values (
    org_id,
    target_template_version_id,
    target_title,
    target_position
  )
  returning id into new_section_id;

  return new_section_id;
end;
$$;

create or replace function private.add_template_question_internal(
  target_template_version_id uuid,
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
  new_question_id uuid;
begin
  if not exists (
    select 1
    from public.template_versions template_version
    where template_version.organisation_id = org_id
      and template_version.id = target_template_version_id
      and template_version.status = 'draft'
  ) then
    raise exception 'template version is not editable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.template_sections section_row
    where section_row.organisation_id = org_id
      and section_row.id = target_section_id
      and section_row.template_version_id = target_template_version_id
  ) then
    raise exception 'template section does not belong to version'
      using errcode = '23503';
  end if;

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
    target_template_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    target_position,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  )
  returning id into new_question_id;

  return new_question_id;
end;
$$;

create or replace function private.publish_template_version_internal(
  target_template_version_id uuid,
  target_organisation_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_template_id uuid;
begin
  select template_version.template_id
  into target_template_id
  from public.template_versions template_version
  where template_version.organisation_id = target_organisation_id
    and template_version.id = target_template_version_id
    and template_version.status = 'draft'
  for update;

  if not found then
    raise exception 'template version is not publishable'
      using errcode = '55000';
  end if;

  update public.template_versions
  set status = 'published',
      published_by_membership_id = target_actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = target_template_version_id;

  perform private.append_business_audit(
    target_organisation_id,
    'template.published',
    target_template_id,
    'succeeded',
    jsonb_build_object('template_version_id', target_template_version_id)
  );

  perform private.enqueue_domain_event(
    target_organisation_id,
    target_template_id,
    'TemplatePublished',
    target_template_version_id::text,
    jsonb_build_object('template_version_id', target_template_version_id)
  );

  return true;
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

create or replace function private.publish_template_version(
  target_template_version_id uuid
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template publication is not authorised'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template_version(target_template_version_id) then
    raise exception 'maturity assessment template publication must use maturity operations'
      using errcode = '42501';
  end if;

  return private.publish_template_version_internal(
    target_template_version_id,
    org_id,
    actor_membership_id
  );
end;
$$;

create or replace function private.upsert_template_answer(
  target_submission_id uuid,
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
  submission_version_id uuid;
  answer_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'submissions.create', null, null) then
    raise exception 'template answer upsert is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_template_submission(org_id, target_submission_id) then
    raise exception 'submission is not accessible'
      using errcode = '42501';
  end if;

  select submission_row.template_version_id
  into submission_version_id
  from public.template_submissions submission_row
  where submission_row.organisation_id = org_id
    and submission_row.id = target_submission_id
    and submission_row.status = 'draft';

  if submission_version_id is null then
    raise exception 'submission is not editable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.id = target_question_id
      and question_row.template_version_id = submission_version_id
  ) then
    raise exception 'question does not belong to submission version'
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

create or replace function private.add_template_section(
  target_template_version_id uuid,
  target_title text,
  target_position integer
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template section creation is not authorised'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template_version(target_template_version_id) then
    raise exception 'maturity assessment template sections must use maturity operations'
      using errcode = '42501';
  end if;

  return private.add_template_section_internal(
    target_template_version_id,
    target_title,
    target_position
  );
end;
$$;

create or replace function private.add_template_question(
  target_template_version_id uuid,
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template question creation is not authorised'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template_version(target_template_version_id) then
    raise exception 'maturity assessment template questions must use maturity operations'
      using errcode = '42501';
  end if;

  return private.add_template_question_internal(
    target_template_version_id,
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

create or replace function private.create_template_successor_version(
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template successor creation is not authorised'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template(target_template_id) then
    raise exception 'maturity assessment template successors must use maturity operations'
      using errcode = '42501';
  end if;

  return private.create_template_successor_version_internal(target_template_id);
end;
$$;

create or replace function public.upsert_template_answer(
  target_submission_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.upsert_template_answer(
    target_submission_id,
    target_question_id,
    target_is_not_applicable,
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value
  )
$$;

create or replace function public.add_template_section(
  target_template_version_id uuid,
  target_title text,
  target_position integer
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.add_template_section(
    target_template_version_id,
    target_title,
    target_position
  )
$$;

create or replace function public.add_template_question(
  target_template_version_id uuid,
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.add_template_question(
    target_template_version_id,
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

create or replace function public.create_template_successor_version(
  target_template_id uuid
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_template_successor_version(target_template_id)
$$;

grant execute on function public.upsert_template_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;
grant execute on function public.add_template_section(uuid, text, integer) to authenticated;
grant execute on function public.add_template_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) to authenticated;
grant execute on function public.create_template_successor_version(uuid) to authenticated;

alter function private.is_maturity_assessment_template_version(uuid)
  owner to lean_hub_private_owner;
alter function private.is_maturity_assessment_template(uuid)
  owner to lean_hub_private_owner;
alter function private.add_template_section_internal(uuid, text, integer)
  owner to lean_hub_private_owner;
alter function private.add_template_question_internal(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) owner to lean_hub_private_owner;
alter function private.publish_template_version_internal(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.create_template_successor_version_internal(uuid)
  owner to lean_hub_private_owner;
alter function private.upsert_template_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) owner to lean_hub_private_owner;
alter function private.add_template_section(uuid, text, integer)
  owner to lean_hub_private_owner;
alter function private.add_template_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) owner to lean_hub_private_owner;
alter function private.create_template_successor_version(uuid)
  owner to lean_hub_private_owner;
