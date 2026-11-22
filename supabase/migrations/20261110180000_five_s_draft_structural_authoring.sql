-- 5S draft structural authoring: remove questions/sections and discard successor drafts.
-- Published templates remain immutable via guard triggers; only draft standard versions are editable.

create or replace function private.remove_five_s_question(
  target_question_id uuid
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
  linked_standard_version_id uuid;
  linked_standard_id uuid;
  linked_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S question removal is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.id,
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_version_id, linked_standard_id, linked_template_version_id
  from public.template_questions question_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = question_row.organisation_id
   and standard_version.template_version_id = question_row.template_version_id
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  for update of question_row, standard_version;

  if linked_standard_version_id is null then
    raise exception '5S question is not removable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = linked_standard_version_id
      and version_row.status = 'draft'
  ) then
    raise exception '5S question is not removable'
      using errcode = '55000';
  end if;

  delete from public.five_s_question_scoring scoring_row
  where scoring_row.organisation_id = org_id
    and scoring_row.standard_version_id = linked_standard_version_id
    and scoring_row.question_id = target_question_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
    and question_row.template_version_id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.question.removed',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'standard_version_id', linked_standard_version_id,
      'question_id', target_question_id
    )
  );

  return true;
end;
$$;

create or replace function private.remove_five_s_section(
  target_section_id uuid
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
  linked_standard_version_id uuid;
  linked_standard_id uuid;
  linked_template_version_id uuid;
  orphan_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S section removal is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.id,
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_version_id, linked_standard_id, linked_template_version_id
  from public.template_sections section_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = section_row.organisation_id
   and standard_version.template_version_id = section_row.template_version_id
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
  for update of section_row, standard_version;

  if linked_standard_version_id is null then
    raise exception '5S section is not removable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = linked_standard_version_id
      and version_row.status = 'draft'
  ) then
    raise exception '5S section is not removable'
      using errcode = '55000';
  end if;

  for orphan_question_id in
    select question_row.id
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.section_id = target_section_id
      and question_row.template_version_id = linked_template_version_id
  loop
    delete from public.five_s_question_scoring scoring_row
    where scoring_row.organisation_id = org_id
      and scoring_row.standard_version_id = linked_standard_version_id
      and scoring_row.question_id = orphan_question_id;

    delete from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.id = orphan_question_id;
  end loop;

  delete from public.five_s_section_weights weight_row
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = linked_standard_version_id
    and weight_row.section_id = target_section_id;

  delete from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
    and section_row.template_version_id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.section.removed',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'standard_version_id', linked_standard_version_id,
      'section_id', target_section_id
    )
  );

  return true;
end;
$$;

-- Discarding a draft deletes the version-owned template snapshot. Refuse when this is the
-- standard's only version (never-published brand-new drafts must be edited or published, not
-- discarded) so the parent standard always retains at least one version row.
create or replace function private.discard_five_s_standard_draft(
  target_standard_version_id uuid
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
  linked_standard_id uuid;
  linked_template_version_id uuid;
  version_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S draft discard is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_id, linked_template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if linked_standard_id is null then
    raise exception '5S draft version was not found'
      using errcode = 'P0002';
  end if;

  select count(*)
  into version_count
  from public.five_s_standard_versions version_row
  where version_row.organisation_id = org_id
    and version_row.standard_id = linked_standard_id;

  if version_count <= 1 then
    raise exception '5S standard requires at least one version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.five_s_audits audit_row
    where audit_row.organisation_id = org_id
      and audit_row.standard_version_id = target_standard_version_id
  ) then
    raise exception 'draft version is referenced by audits and cannot be discarded'
      using errcode = '55000';
  end if;

  delete from public.five_s_question_scoring scoring_row
  where scoring_row.organisation_id = org_id
    and scoring_row.standard_version_id = target_standard_version_id;

  delete from public.five_s_section_weights weight_row
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = target_standard_version_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.template_version_id = linked_template_version_id;

  delete from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.template_version_id = linked_template_version_id;

  delete from public.five_s_standard_versions version_row
  where version_row.organisation_id = org_id
    and version_row.id = target_standard_version_id;

  delete from public.template_versions template_version_row
  where template_version_row.organisation_id = org_id
    and template_version_row.id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.draft_discarded',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object('standard_version_id', target_standard_version_id)
  );

  return true;
end;
$$;

create or replace function public.remove_five_s_question(target_question_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.remove_five_s_question(target_question_id)
$$;

create or replace function public.remove_five_s_section(target_section_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.remove_five_s_section(target_section_id)
$$;

create or replace function public.discard_five_s_standard_draft(target_standard_version_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.discard_five_s_standard_draft(target_standard_version_id)
$$;

grant execute on function public.remove_five_s_question(uuid) to authenticated;
grant execute on function public.remove_five_s_section(uuid) to authenticated;
grant execute on function public.discard_five_s_standard_draft(uuid) to authenticated;

revoke all on function public.remove_five_s_question(uuid) from public, anon, service_role;
revoke all on function public.remove_five_s_section(uuid) from public, anon, service_role;
revoke all on function public.discard_five_s_standard_draft(uuid) from public, anon, service_role;

alter function private.remove_five_s_question(uuid)
  owner to lean_hub_private_owner;
alter function private.remove_five_s_section(uuid)
  owner to lean_hub_private_owner;
alter function private.discard_five_s_standard_draft(uuid)
  owner to lean_hub_private_owner;

revoke all on function private.remove_five_s_question(uuid) from public, anon;
revoke all on function private.remove_five_s_section(uuid) from public, anon;
revoke all on function private.discard_five_s_standard_draft(uuid) from public, anon;

grant execute on function private.remove_five_s_question(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.remove_five_s_section(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.discard_five_s_standard_draft(uuid) to authenticated, lean_hub_private_owner;

-- Serialize draft structural edits with publish by locking the standard version row.
create or replace function private.add_five_s_section(
  target_standard_version_id uuid,
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
  template_version_id uuid;
  version_status text;
  new_section_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S section creation is not authorised'
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

  new_section_id := private.add_template_section_internal(
    template_version_id,
    target_title,
    target_position
  );

  insert into public.five_s_section_weights (
    organisation_id, standard_version_id, section_id, weight
  )
  values (org_id, target_standard_version_id, new_section_id, 1)
  on conflict (organisation_id, standard_version_id, section_id) do nothing;

  return new_section_id;
end;
$$;

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
