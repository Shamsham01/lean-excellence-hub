-- Fail closed when publishing 5S/Gemba drafts that have no usable child questions.
-- Replaces private publish functions only. Public wrappers, grants, and RLS are unchanged.

create or replace function private.publish_five_s_standard_version(
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
  template_version_id uuid;
  standard_id uuid;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard publication is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.template_version_id,
    standard_version.standard_id
  into template_version_id, standard_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if not found then
    raise exception '5S standard version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.template_version_id = template_version_id
      and btrim(question_row.prompt) <> ''
  ) then
    raise exception '5S standard version requires at least one question'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_scoring.scoring_metadata,
      question_row.question_type
    from public.five_s_question_scoring question_scoring
    join public.template_questions question_row
      on question_row.organisation_id = question_scoring.organisation_id
     and question_row.id = question_scoring.question_id
    where question_scoring.organisation_id = org_id
      and question_scoring.standard_version_id = target_standard_version_id
      and question_scoring.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  update public.five_s_standard_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_standard_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id, 'five_s.standard.published', standard_id, 'succeeded',
    jsonb_build_object('standard_version_id', target_standard_version_id)
  );

  return true;
end;
$$;

create or replace function private.publish_gemba_definition_version(
  target_definition_version_id uuid
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
  template_version_id uuid;
  definition_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba definition publication is not authorised'
      using errcode = '42501';
  end if;

  select
    definition_version.template_version_id,
    definition_version.definition_id
  into template_version_id, definition_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft'
  for update;

  if not found then
    raise exception 'gemba definition version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.template_version_id = template_version_id
      and btrim(question_row.prompt) <> ''
  ) then
    raise exception 'gemba definition version requires at least one question'
      using errcode = '55000';
  end if;

  update public.gemba_definition_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_definition_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  return true;
end;
$$;
