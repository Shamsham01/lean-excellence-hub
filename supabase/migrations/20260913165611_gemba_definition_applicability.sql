-- Gemba definition applicability: exact organisational units a definition may
-- be executed or scheduled against.
--
-- Lifecycle decision (Issue #78): DEFINITION-LEVEL, not version-level.
-- Gemba already treats the definition as the stable executable identity
-- (start_gemba_walk and schedules take definition_id; versions are prompt
-- revisions). Successor versions therefore inherit the same applicable areas
-- unless deliberately changed. This matches the 5S standard-level precedent.
--
-- Exact-unit multi-select. No subtree semantics. Empty mapping is fail-closed
-- (not "all units"). No hosted data backfill is performed here.
-- Applicability is an additional domain constraint; existing RBAC/RLS remains
-- the security authority. This migration does not broaden grants, roles, or
-- RLS write access.

create table public.gemba_definition_applicable_units (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  definition_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_definition_applicable_units_organisation_id_id_key
    unique (organisation_id, id),
  constraint gemba_definition_applicable_units_definition_unit_key
    unique (organisation_id, definition_id, unit_id),
  constraint gemba_definition_applicable_units_definition_fkey
    foreign key (organisation_id, definition_id)
    references public.gemba_definitions(organisation_id, id)
    on delete restrict,
  constraint gemba_definition_applicable_units_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict
);

create index gemba_definition_applicable_units_definition_idx
  on public.gemba_definition_applicable_units (organisation_id, definition_id);

create index gemba_definition_applicable_units_unit_idx
  on public.gemba_definition_applicable_units (organisation_id, unit_id);

create trigger gemba_definition_applicable_units_prevent_org_change
before update on public.gemba_definition_applicable_units
for each row execute function private.prevent_organisation_id_change();

alter table public.gemba_definition_applicable_units enable row level security;
alter table public.gemba_definition_applicable_units force row level security;

revoke all on public.gemba_definition_applicable_units
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.gemba_definition_applicable_units
  to lean_hub_private_owner;

create policy private_owner_all_gemba_definition_applicable_units
on public.gemba_definition_applicable_units for all to lean_hub_private_owner
using (true) with check (true);

create policy gemba_definition_applicable_units_select
on public.gemba_definition_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

grant select on public.gemba_definition_applicable_units to authenticated;

create or replace function private.gemba_definition_applies_to_unit(
  target_organisation_id uuid,
  target_definition_id uuid,
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
    from public.gemba_definition_applicable_units applicability_row
    join public.organisation_units unit_row
      on unit_row.organisation_id = applicability_row.organisation_id
     and unit_row.id = applicability_row.unit_id
    where applicability_row.organisation_id = target_organisation_id
      and applicability_row.definition_id = target_definition_id
      and applicability_row.unit_id = target_unit_id
      and unit_row.status = 'active'
  )
$$;

create or replace function private.gemba_definition_has_active_applicable_unit(
  target_organisation_id uuid,
  target_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gemba_definition_applicable_units applicability_row
    join public.organisation_units unit_row
      on unit_row.organisation_id = applicability_row.organisation_id
     and unit_row.id = applicability_row.unit_id
    where applicability_row.organisation_id = target_organisation_id
      and applicability_row.definition_id = target_definition_id
      and unit_row.status = 'active'
  )
$$;

create or replace function private.assert_activity_unit_is_applicable(
  target_organisation_id uuid,
  target_activity_resource_id uuid,
  target_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_type text;
begin
  resource_type := private.schedule_activity_resource_type(
    target_organisation_id,
    target_activity_resource_id
  );

  if resource_type = 'five_s_standard' then
    if not private.five_s_standard_applies_to_unit(
      target_organisation_id,
      target_activity_resource_id,
      target_unit_id
    ) then
      raise exception
        '5S standard is not applicable to the selected organisational unit'
        using errcode = '22023';
    end if;
    return;
  end if;

  if resource_type = 'gemba_definition' then
    if not private.gemba_definition_applies_to_unit(
      target_organisation_id,
      target_activity_resource_id,
      target_unit_id
    ) then
      raise exception
        'gemba definition is not applicable to the selected organisational unit'
        using errcode = '22023';
    end if;
    return;
  end if;
end;
$$;

create or replace function private.set_gemba_definition_applicable_units(
  target_definition_id uuid,
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
      'gemba.definitions.manage',
      null,
      null
    ) then
    raise exception 'gemba definition applicability update is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gemba_definitions definition_row
    where definition_row.organisation_id = org_id
      and definition_row.id = target_definition_id
  ) then
    raise exception 'gemba definition was not found'
      using errcode = '23503';
  end if;

  select array_agg(distinct candidate.unit_id)
  into unique_unit_ids
  from unnest(coalesce(target_unit_ids, array[]::uuid[])) as candidate(unit_id)
  where candidate.unit_id is not null;

  if unique_unit_ids is null or cardinality(unique_unit_ids) = 0 then
    raise exception
      'gemba definition requires at least one applicable organisational unit'
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
        'gemba definition applicability includes an invalid organisational unit'
        using errcode = '23503';
    end if;

    if candidate_unit_status is distinct from 'active' then
      raise exception
        'gemba definition applicability includes an inactive organisational unit'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = org_id
      and schedule_row.activity_resource_id = target_definition_id
      and schedule_row.status = 'active'
      and not (schedule_row.unit_id = any (unique_unit_ids))
  ) then
    raise exception
      'Cannot remove Gemba applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.'
      using errcode = '22023';
  end if;

  delete from public.gemba_definition_applicable_units applicability_row
  where applicability_row.organisation_id = org_id
    and applicability_row.definition_id = target_definition_id;

  insert into public.gemba_definition_applicable_units (
    organisation_id,
    definition_id,
    unit_id
  )
  select
    org_id,
    target_definition_id,
    candidate.unit_id
  from unnest(unique_unit_ids) as candidate(unit_id);

  perform private.append_business_audit(
    org_id,
    'gemba.definition.applicability_updated',
    target_definition_id,
    'succeeded',
    jsonb_build_object('unit_ids', unique_unit_ids)
  );

  return true;
end;
$$;

create or replace function public.set_gemba_definition_applicable_units(
  target_definition_id uuid,
  target_unit_ids uuid[]
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_gemba_definition_applicable_units(
    target_definition_id,
    target_unit_ids
  )
$$;

drop function if exists public.create_gemba_definition_draft(text, text, integer);
drop function if exists private.create_gemba_definition_draft(text, text, integer);

create function private.create_gemba_definition_draft(
  target_display_name text,
  target_description text default null,
  target_expected_duration_minutes integer default null,
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
  new_definition_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba definition creation is not authorised'
      using errcode = '42501';
  end if;

  new_definition_id := private.register_resource_record(
    org_id, 'gemba_definition', gen_random_uuid(), actor_membership_id
  );

  new_template_id := private.register_resource_record(
    org_id, 'template', gen_random_uuid(), actor_membership_id
  );

  insert into public.templates (
    id, organisation_id, experience_type, display_name, description, created_by_membership_id
  )
  values (
    new_template_id, org_id, 'gemba_walk', target_display_name, target_description, actor_membership_id
  );

  insert into public.gemba_definitions (
    id, organisation_id, template_id, display_name, description, created_by_membership_id
  )
  values (
    new_definition_id, org_id, new_template_id, target_display_name, target_description, actor_membership_id
  );

  insert into public.template_versions (
    organisation_id, template_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_template_id, 1, 'draft', actor_membership_id)
  returning id into new_template_version_id;

  insert into public.gemba_definition_versions (
    organisation_id, definition_id, template_version_id, version_number, status,
    expected_duration_minutes, created_by_membership_id
  )
  values (
    org_id, new_definition_id, new_template_version_id, 1, 'draft',
    target_expected_duration_minutes, actor_membership_id
  );

  if target_unit_ids is not null then
    perform private.set_gemba_definition_applicable_units(
      new_definition_id,
      target_unit_ids
    );
  end if;

  return new_definition_id;
end;
$$;

create function public.create_gemba_definition_draft(
  target_display_name text,
  target_description text default null,
  target_expected_duration_minutes integer default null,
  target_unit_ids uuid[] default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_gemba_definition_draft(
    target_display_name,
    target_description,
    target_expected_duration_minutes,
    target_unit_ids
  )
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
  linked_template_version_id uuid;
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
  into linked_template_version_id, definition_id
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
      and question_row.template_version_id = linked_template_version_id
      and btrim(question_row.prompt) <> ''
  ) then
    raise exception 'gemba definition version requires at least one question'
      using errcode = '55000';
  end if;

  if not private.gemba_definition_has_active_applicable_unit(org_id, definition_id) then
    raise exception
      'gemba definition requires at least one applicable organisational unit'
      using errcode = '55000';
  end if;

  update public.gemba_definition_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_definition_version_id;

  perform private.publish_template_version_internal(
    linked_template_version_id,
    org_id,
    actor_membership_id
  );

  return true;
end;
$$;

create or replace function private.start_gemba_walk(
  target_definition_id uuid,
  target_unit_id uuid,
  target_schedule_occurrence_id uuid default null
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
  definition_version_id uuid;
  template_version_id uuid;
  new_walk_id uuid;
  new_submission_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'gemba walk start is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(org_id, 'gemba.walk.perform', null, target_unit_id)
    and not private.has_scoped_permission(org_id, 'gemba.walk.perform', actor_membership_id, null) then
    raise exception 'gemba walk start is not authorised'
      using errcode = '42501';
  end if;

  select definition_version.id, definition_version.template_version_id
  into definition_version_id, template_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.definition_id = target_definition_id
    and definition_version.status = 'published'
  order by definition_version.version_number desc
  limit 1;

  if definition_version_id is null then
    raise exception 'gemba definition has no published version'
      using errcode = '55000';
  end if;

  if not private.gemba_definition_applies_to_unit(
    org_id,
    target_definition_id,
    target_unit_id
  ) then
    raise exception
      'gemba definition is not applicable to the selected organisational unit'
      using errcode = '22023';
  end if;

  if target_schedule_occurrence_id is not null then
    if not exists (
      select 1
      from public.schedule_occurrences occurrence_row
      join public.schedule_definitions schedule_row
        on schedule_row.organisation_id = occurrence_row.organisation_id
       and schedule_row.id = occurrence_row.schedule_definition_id
      where occurrence_row.organisation_id = org_id
        and occurrence_row.id = target_schedule_occurrence_id
        and occurrence_row.lifecycle_status = 'open'
        and schedule_row.activity_resource_id = target_definition_id
        and private.gemba_definition_applies_to_unit(
          org_id,
          target_definition_id,
          occurrence_row.unit_id
        )
    ) then
      raise exception 'schedule occurrence is not valid for this gemba definition'
        using errcode = '55000';
    end if;
  end if;

  new_walk_id := private.register_resource_record(
    org_id, 'gemba_walk', gen_random_uuid(), actor_membership_id
  );

  new_submission_id := private.register_resource_record(
    org_id, 'template_submission', gen_random_uuid(), actor_membership_id
  );

  insert into public.template_submissions (
    id, organisation_id, template_version_id, created_by_membership_id
  )
  values (new_submission_id, org_id, template_version_id, actor_membership_id);

  insert into public.gemba_walks (
    id, organisation_id, definition_version_id, unit_id, submission_id,
    schedule_occurrence_id, leader_membership_id, status, started_at, created_by_membership_id
  )
  values (
    new_walk_id, org_id, definition_version_id, target_unit_id, new_submission_id,
    target_schedule_occurrence_id, actor_membership_id, 'in_progress', statement_timestamp(), actor_membership_id
  );

  perform private.enqueue_domain_event(
    org_id, new_walk_id, 'GembaWalkStarted', new_walk_id::text,
    jsonb_build_object('walk_id', new_walk_id)
  );

  return new_walk_id;
end;
$$;

grant execute on function public.set_gemba_definition_applicable_units(uuid, uuid[])
  to authenticated;
grant execute on function public.create_gemba_definition_draft(text, text, integer, uuid[])
  to authenticated;

revoke all on function public.set_gemba_definition_applicable_units(uuid, uuid[])
  from public, anon;
revoke all on function public.create_gemba_definition_draft(text, text, integer, uuid[])
  from public, anon;

alter function private.gemba_definition_applies_to_unit(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.gemba_definition_has_active_applicable_unit(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.assert_activity_unit_is_applicable(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.set_gemba_definition_applicable_units(uuid, uuid[])
  owner to lean_hub_private_owner;
alter function private.create_gemba_definition_draft(text, text, integer, uuid[])
  owner to lean_hub_private_owner;
