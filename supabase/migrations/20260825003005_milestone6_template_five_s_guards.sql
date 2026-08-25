create or replace function private.is_five_s_audit_template_version(
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
      and template_row.experience_type = 'five_s_audit'
  )
$$;

create or replace function private.is_five_s_audit_template(
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
      and template_row.experience_type = 'five_s_audit'
  )
$$;

create or replace function private.is_gemba_walk_template_version(
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
      and template_row.experience_type = 'gemba_walk'
  )
$$;

create or replace function private.is_gemba_walk_template(
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
      and template_row.experience_type = 'gemba_walk'
  )
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

  if private.is_five_s_audit_template_version(target_template_version_id) then
    raise exception '5S audit template publication must use 5S operations'
      using errcode = '42501';
  end if;

  if private.is_gemba_walk_template_version(target_template_version_id) then
    raise exception 'gemba walk template publication must use gemba operations'
      using errcode = '42501';
  end if;

  return private.publish_template_version_internal(
    target_template_version_id,
    org_id,
    actor_membership_id
  );
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
