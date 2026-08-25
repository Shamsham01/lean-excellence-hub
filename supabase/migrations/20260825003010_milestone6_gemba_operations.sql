-- Gemba walk operations (template guards for gemba_walk are in 03005).

create or replace function private.can_read_gemba_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(target_organisation_id, 'gemba.read', null, null)
$$;

create or replace function private.can_read_gemba_walk(
  target_organisation_id uuid,
  target_walk_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gemba_walks walk_row
    where walk_row.organisation_id = target_organisation_id
      and walk_row.id = target_walk_id
      and (
        private.has_scoped_permission(target_organisation_id, 'gemba.read', null, null)
        or private.has_scoped_permission(target_organisation_id, 'gemba.read', null, walk_row.unit_id)
        or private.has_scoped_permission(target_organisation_id, 'gemba.read', walk_row.leader_membership_id, null)
        or private.has_scoped_permission(target_organisation_id, 'gemba.walk.review', null, walk_row.unit_id)
      )
  )
$$;

create or replace function private.can_edit_gemba_walk(
  target_organisation_id uuid,
  target_walk_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gemba_walks walk_row
    where walk_row.organisation_id = target_organisation_id
      and walk_row.id = target_walk_id
      and walk_row.status in ('draft', 'in_progress')
      and (
        private.has_scoped_permission(target_organisation_id, 'gemba.walk.perform', null, walk_row.unit_id)
        or private.has_scoped_permission(target_organisation_id, 'gemba.walk.perform', walk_row.leader_membership_id, null)
      )
  )
$$;

create or replace function private.create_gemba_definition_draft(
  target_display_name text,
  target_description text default null,
  target_expected_duration_minutes integer default null
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

  return new_definition_id;
end;
$$;

create or replace function private.add_gemba_section(
  target_definition_version_id uuid,
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
  template_version_id uuid;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba section creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_version.template_version_id
  into template_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft';

  if template_version_id is null then
    raise exception 'gemba definition version is not editable'
      using errcode = '55000';
  end if;

  return private.add_template_section_internal(
    template_version_id,
    target_title,
    target_position
  );
end;
$$;

create or replace function private.add_gemba_question(
  target_definition_version_id uuid,
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
  template_version_id uuid;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'gemba.definitions.manage', null, null) then
    raise exception 'gemba question creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_version.template_version_id
  into template_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft';

  if template_version_id is null then
    raise exception 'gemba definition version is not editable'
      using errcode = '55000';
  end if;

  return private.add_template_question_internal(
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

create or replace function private.upsert_gemba_walk_answer(
  target_walk_id uuid,
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
  target_submission_id uuid;
begin
  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba walk answer upsert is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.submission_id
  into target_submission_id
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = target_walk_id;

  return private.upsert_template_answer(
    target_submission_id,
    target_question_id,
    target_is_not_applicable,
    target_text_value,
    target_number_value,
    target_date_value,
    target_json_value
  );
end;
$$;

create or replace function private.create_gemba_observation(
  target_walk_id uuid,
  target_observation_text text,
  target_observation_type text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null
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
  new_observation_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba observation creation is not authorised'
      using errcode = '42501';
  end if;

  if target_observation_type not in (
    'positive_practice', 'improvement_opportunity', 'issue'
  ) then
    raise exception 'invalid observation type'
      using errcode = '22023';
  end if;

  insert into public.gemba_walk_observations (
    organisation_id, walk_id, section_id, question_id,
    observation_text, observation_type, severity, priority, created_by_membership_id
  )
  values (
    org_id, target_walk_id, target_section_id, target_question_id,
    target_observation_text, target_observation_type, target_severity, target_priority, actor_membership_id
  )
  returning id into new_observation_id;

  perform private.enqueue_domain_event(
    org_id, target_walk_id, 'GembaObservationCreated', new_observation_id::text,
    jsonb_build_object('observation_id', new_observation_id)
  );

  return new_observation_id;
end;
$$;

create or replace function private.complete_gemba_walk(
  target_walk_id uuid,
  target_summary_notes text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  walk_row public.gemba_walks%rowtype;
  definition_row public.gemba_definitions%rowtype;
  definition_version_row public.gemba_definition_versions%rowtype;
  template_version_row public.template_versions%rowtype;
  unit_row public.organisation_units%rowtype;
begin
  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba walk completion is not authorised'
      using errcode = '42501';
  end if;

  select walk_item.*
  into walk_row
  from public.gemba_walks walk_item
  where walk_item.organisation_id = org_id
    and walk_item.id = target_walk_id
  for update;

  select definition_item.*
  into definition_row
  from public.gemba_definitions definition_item
  join public.gemba_definition_versions definition_version
    on definition_version.organisation_id = definition_item.organisation_id
   and definition_version.definition_id = definition_item.id
  where definition_version.organisation_id = org_id
    and definition_version.id = walk_row.definition_version_id;

  select definition_version_item.*
  into definition_version_row
  from public.gemba_definition_versions definition_version_item
  where definition_version_item.organisation_id = org_id
    and definition_version_item.id = walk_row.definition_version_id;

  select template_version_item.*
  into template_version_row
  from public.template_versions template_version_item
  where template_version_item.organisation_id = org_id
    and template_version_item.id = definition_version_row.template_version_id;

  select unit_item.*
  into unit_row
  from public.organisation_units unit_item
  where unit_item.organisation_id = org_id
    and unit_item.id = walk_row.unit_id;

  update public.gemba_walks
  set status = 'completed',
      completed_at = statement_timestamp(),
      summary_notes = target_summary_notes,
      definition_name_snapshot = definition_row.display_name,
      template_version_number_snapshot = template_version_row.version_number,
      unit_name_snapshot = unit_row.name,
      unit_code_snapshot = unit_row.code
  where organisation_id = org_id
    and id = target_walk_id;

  perform private.complete_template_submission(walk_row.submission_id);

  if walk_row.schedule_occurrence_id is not null then
    perform private.complete_schedule_occurrence(
      walk_row.schedule_occurrence_id,
      target_walk_id
    );
  end if;

  perform private.enqueue_domain_event(
    org_id, target_walk_id, 'GembaWalkCompleted', target_walk_id::text,
    jsonb_build_object('walk_id', target_walk_id)
  );

  return true;
end;
$$;

create policy gemba_definitions_select
on public.gemba_definitions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

create policy gemba_definition_versions_select
on public.gemba_definition_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

create policy gemba_walks_select
on public.gemba_walks for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_walk(organisation_id, id)
);

create policy gemba_walk_participants_select
on public.gemba_walk_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_walk(organisation_id, walk_id)
);

create policy gemba_walk_observations_select
on public.gemba_walk_observations for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_walk(organisation_id, walk_id)
);

create policy gemba_evidence_links_select
on public.gemba_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_walk(organisation_id, walk_id)
);

create policy gemba_action_context_select
on public.gemba_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_walk(organisation_id, walk_id)
);

grant select on public.gemba_definitions to authenticated;
grant select on public.gemba_definition_versions to authenticated;
grant select on public.gemba_walks to authenticated;
grant select on public.gemba_walk_participants to authenticated;
grant select on public.gemba_walk_observations to authenticated;
grant select on public.gemba_evidence_links to authenticated;
grant select on public.gemba_action_context to authenticated;

create or replace function public.create_gemba_definition_draft(
  target_display_name text,
  target_description text default null,
  target_expected_duration_minutes integer default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_gemba_definition_draft(
  target_display_name, target_description, target_expected_duration_minutes
) $$;

create or replace function public.add_gemba_section(
  target_definition_version_id uuid,
  target_title text,
  target_position integer
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_gemba_section(target_definition_version_id, target_title, target_position) $$;

create or replace function public.add_gemba_question(
  target_definition_version_id uuid,
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
language sql volatile security definer set search_path = ''
as $$ select private.add_gemba_question(
  target_definition_version_id, target_section_id, target_question_type, target_prompt,
  target_position, target_is_required, target_allows_not_applicable, target_help_text, target_options
) $$;

create or replace function public.publish_gemba_definition_version(target_definition_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_gemba_definition_version(target_definition_version_id) $$;

create or replace function public.start_gemba_walk(
  target_definition_id uuid,
  target_unit_id uuid,
  target_schedule_occurrence_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.start_gemba_walk(target_definition_id, target_unit_id, target_schedule_occurrence_id) $$;

create or replace function public.upsert_gemba_walk_answer(
  target_walk_id uuid,
  target_question_id uuid,
  target_is_not_applicable boolean default false,
  target_text_value text default null,
  target_number_value numeric default null,
  target_date_value date default null,
  target_json_value jsonb default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.upsert_gemba_walk_answer(
  target_walk_id, target_question_id, target_is_not_applicable,
  target_text_value, target_number_value, target_date_value, target_json_value
) $$;

create or replace function public.create_gemba_observation(
  target_walk_id uuid,
  target_observation_text text,
  target_observation_type text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_gemba_observation(
  target_walk_id, target_observation_text, target_observation_type,
  target_section_id, target_question_id, target_severity, target_priority
) $$;

create or replace function public.complete_gemba_walk(
  target_walk_id uuid,
  target_summary_notes text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.complete_gemba_walk(target_walk_id, target_summary_notes) $$;

grant execute on function public.create_gemba_definition_draft(text, text, integer) to authenticated;
grant execute on function public.add_gemba_section(uuid, text, integer) to authenticated;
grant execute on function public.add_gemba_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) to authenticated;
grant execute on function public.publish_gemba_definition_version(uuid) to authenticated;
grant execute on function public.start_gemba_walk(uuid, uuid, uuid) to authenticated;
grant execute on function public.upsert_gemba_walk_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;
grant execute on function public.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text
) to authenticated;
grant execute on function public.complete_gemba_walk(uuid, text) to authenticated;
