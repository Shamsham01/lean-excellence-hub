-- Issue #75 review follow-up: atomic 5S create+applicability, publish
-- readiness for post-migration standards, bidirectional schedule invariant,
-- and active-unit lifecycle at the DB boundary.
-- Does not backfill hosted data or broaden grants/RLS.

create or replace function private.five_s_standard_applies_to_unit(
  target_organisation_id uuid,
  target_standard_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.five_s_standard_applicable_units applicability_row
    join public.organisation_units unit_row
      on unit_row.organisation_id = applicability_row.organisation_id
     and unit_row.id = applicability_row.unit_id
    where applicability_row.organisation_id = target_organisation_id
      and applicability_row.standard_id = target_standard_id
      and applicability_row.unit_id = target_unit_id
      and unit_row.status = 'active'
  )
$$;

create or replace function private.five_s_standard_has_active_applicable_unit(
  target_organisation_id uuid,
  target_standard_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.five_s_standard_applicable_units applicability_row
    join public.organisation_units unit_row
      on unit_row.organisation_id = applicability_row.organisation_id
     and unit_row.id = applicability_row.unit_id
    where applicability_row.organisation_id = target_organisation_id
      and applicability_row.standard_id = target_standard_id
      and unit_row.status = 'active'
  )
$$;

create or replace function private.set_five_s_standard_applicable_units(
  target_standard_id uuid,
  target_unit_ids uuid[]
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
  unique_unit_ids uuid[];
  candidate_unit_id uuid;
  candidate_unit_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'five_s.standards.manage',
      null,
      null
    ) then
    raise exception '5S standard applicability update is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.five_s_standards standard_row
    where standard_row.organisation_id = org_id
      and standard_row.id = target_standard_id
  ) then
    raise exception '5S standard was not found'
      using errcode = '23503';
  end if;

  select array_agg(distinct candidate.unit_id)
  into unique_unit_ids
  from unnest(coalesce(target_unit_ids, array[]::uuid[])) as candidate(unit_id)
  where candidate.unit_id is not null;

  if unique_unit_ids is null or cardinality(unique_unit_ids) = 0 then
    raise exception
      '5S standard requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;

  foreach candidate_unit_id in array unique_unit_ids
  loop
    select unit_row.status
    into candidate_unit_status
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = candidate_unit_id;

    if candidate_unit_status is null then
      raise exception
        '5S standard applicability includes an invalid organisational unit'
        using errcode = '23503';
    end if;

    if candidate_unit_status is distinct from 'active' then
      raise exception
        '5S standard applicability includes an inactive organisational unit'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = org_id
      and schedule_row.activity_resource_id = target_standard_id
      and schedule_row.status = 'active'
      and not (schedule_row.unit_id = any (unique_unit_ids))
  ) then
    raise exception
      'Cannot remove 5S applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.'
      using errcode = '22023';
  end if;

  delete from public.five_s_standard_applicable_units applicability_row
  where applicability_row.organisation_id = org_id
    and applicability_row.standard_id = target_standard_id;

  insert into public.five_s_standard_applicable_units (
    organisation_id,
    standard_id,
    unit_id
  )
  select
    org_id,
    target_standard_id,
    candidate.unit_id
  from unnest(unique_unit_ids) as candidate(unit_id);

  perform private.append_business_audit(
    org_id,
    'five_s.standard.applicability_updated',
    target_standard_id,
    'succeeded',
    jsonb_build_object('unit_ids', unique_unit_ids)
  );

  return true;
end;
$$;

drop function if exists public.create_five_s_standard_draft(text, text, numeric);
drop function if exists private.create_five_s_standard_draft(text, text, numeric);

create function private.create_five_s_standard_draft(
  target_display_name text,
  target_description text default null,
  target_threshold_percent numeric default 90,
  target_unit_ids uuid[] default null
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
  new_standard_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
  new_standard_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S standard creation is not authorised'
      using errcode = '42501';
  end if;

  new_standard_id := private.register_resource_record(
    org_id,
    'five_s_standard',
    gen_random_uuid(),
    actor_membership_id
  );

  new_template_id := private.register_resource_record(
    org_id,
    'template',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.templates (
    id, organisation_id, experience_type, display_name, description, created_by_membership_id
  )
  values (
    new_template_id, org_id, 'five_s_audit', target_display_name, target_description, actor_membership_id
  );

  insert into public.five_s_standards (
    id, organisation_id, template_id, display_name, description, created_by_membership_id
  )
  values (
    new_standard_id, org_id, new_template_id, target_display_name, target_description, actor_membership_id
  );

  insert into public.template_versions (
    organisation_id, template_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_template_id, 1, 'draft', actor_membership_id)
  returning id into new_template_version_id;

  insert into public.five_s_standard_versions (
    organisation_id, standard_id, template_version_id, version_number, status,
    target_threshold_percent, created_by_membership_id
  )
  values (
    org_id, new_standard_id, new_template_version_id, 1, 'draft',
    target_threshold_percent, actor_membership_id
  )
  returning id into new_standard_version_id;

  if target_unit_ids is not null then
    perform private.set_five_s_standard_applicable_units(
      new_standard_id,
      target_unit_ids
    );
  end if;

  perform private.append_business_audit(
    org_id, 'five_s.standard.created', new_standard_id, 'succeeded',
    jsonb_build_object('template_id', new_template_id)
  );

  return new_standard_id;
end;
$$;

create function public.create_five_s_standard_draft(
  target_display_name text,
  target_description text default null,
  target_threshold_percent numeric default 90,
  target_unit_ids uuid[] default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_five_s_standard_draft(
    target_display_name,
    target_description,
    target_threshold_percent,
    target_unit_ids
  )
$$;

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
  linked_template_version_id uuid;
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
  into linked_template_version_id, standard_id
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
      and question_row.template_version_id = linked_template_version_id
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

  if not private.five_s_standard_has_active_applicable_unit(org_id, standard_id) then
    raise exception
      '5S standard requires at least one applicable organisational unit'
      using errcode = '55000';
  end if;

  update public.five_s_standard_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_standard_version_id;

  perform private.publish_template_version_internal(
    linked_template_version_id,
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

grant execute on function public.create_five_s_standard_draft(text, text, numeric, uuid[])
  to authenticated;

revoke all on function public.create_five_s_standard_draft(text, text, numeric, uuid[])
  from public, anon;

alter function private.five_s_standard_has_active_applicable_unit(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.create_five_s_standard_draft(text, text, numeric, uuid[])
  owner to lean_hub_private_owner;
