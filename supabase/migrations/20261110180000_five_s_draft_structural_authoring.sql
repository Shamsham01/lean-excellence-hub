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
   and standard_version.status = 'draft'
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  for update of question_row;

  if linked_standard_version_id is null then
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
   and standard_version.status = 'draft'
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
  for update of section_row;

  if linked_standard_version_id is null then
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
