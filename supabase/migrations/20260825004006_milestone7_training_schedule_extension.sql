-- Extend M6 schedule seams for training courses and sessions.

alter table public.training_sessions
  add constraint training_sessions_schedule_occurrence_fkey
  foreign key (organisation_id, schedule_occurrence_id)
  references public.schedule_occurrences(organisation_id, id)
  on delete restrict;

create or replace function private.is_schedule_activity_resource_type(
  target_resource_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_resource_type in (
    'five_s_standard',
    'gemba_definition',
    'training_course'
  )
$$;

create or replace function private.can_reference_schedule_activity_resource(
  target_organisation_id uuid,
  target_activity_resource_id uuid,
  target_unit_id uuid
)
returns boolean
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

  if not private.is_schedule_activity_resource_type(resource_type) then
    return false;
  end if;

  if resource_type = 'five_s_standard' then
    return private.has_scoped_permission(
      target_organisation_id,
      'five_s.read',
      null,
      target_unit_id
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'five_s.read',
      null,
      null
    );
  end if;

  if resource_type = 'gemba_definition' then
    return private.has_scoped_permission(
      target_organisation_id,
      'gemba.read',
      null,
      target_unit_id
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'gemba.read',
      null,
      null
    );
  end if;

  return private.has_scoped_permission(
    target_organisation_id,
    'training.read',
    null,
    target_unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'training.read',
    null,
    null
  );
end;
$$;

create or replace function private.complete_schedule_occurrence(
  target_occurrence_id uuid,
  target_completion_resource_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  occurrence_row public.schedule_occurrences%rowtype;
  completion_type text;
  schedule_activity_type text;
begin
  select occurrence_item.*
  into occurrence_row
  from public.schedule_occurrences occurrence_item
  where occurrence_item.organisation_id = org_id
    and occurrence_item.id = target_occurrence_id
    and occurrence_item.lifecycle_status = 'open'
  for update;

  if not found then
    raise exception 'schedule occurrence is not completable'
      using errcode = '55000';
  end if;

  if not private.can_read_schedule_occurrence(org_id, target_occurrence_id) then
    raise exception 'schedule occurrence completion is not authorised'
      using errcode = '42501';
  end if;

  completion_type := private.schedule_activity_resource_type(
    org_id,
    target_completion_resource_id
  );

  if completion_type not in ('five_s_audit', 'gemba_walk', 'training_session') then
    raise exception 'completion resource type is invalid'
      using errcode = '22023';
  end if;

  select private.schedule_activity_resource_type(
    org_id,
    schedule_row.activity_resource_id
  )
  into schedule_activity_type
  from public.schedule_definitions schedule_row
  where schedule_row.organisation_id = org_id
    and schedule_row.id = occurrence_row.schedule_definition_id;

  if schedule_activity_type = 'five_s_standard' and completion_type <> 'five_s_audit' then
    raise exception 'completion resource does not match schedule activity'
      using errcode = '22023';
  end if;

  if schedule_activity_type = 'gemba_definition' and completion_type <> 'gemba_walk' then
    raise exception 'completion resource does not match schedule activity'
      using errcode = '22023';
  end if;

  if schedule_activity_type = 'training_course' and completion_type <> 'training_session' then
    raise exception 'completion resource does not match schedule activity'
      using errcode = '22023';
  end if;

  update public.schedule_occurrences
  set lifecycle_status = 'completed',
      completion_resource_id = target_completion_resource_id,
      completed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_occurrence_id;

  return true;
end;
$$;

create or replace function private.create_training_session(
  target_course_version_id uuid,
  target_title text,
  target_organisational_unit_id uuid default null,
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_scheduled_start timestamptz default null,
  target_scheduled_end timestamptz default null,
  target_location text default null,
  target_online_metadata jsonb default null,
  target_capacity integer default null,
  target_notes text default null,
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
  new_session_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_sessions(org_id) then
    raise exception 'training session creation is not authorised'
      using errcode = '42501';
  end if;

  new_session_id := private.register_resource_record(
    org_id,
    'training_session',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.training_sessions (
    id,
    organisation_id,
    course_version_id,
    title,
    organisational_unit_id,
    trainer_membership_id,
    trainer_name,
    scheduled_start,
    scheduled_end,
    location,
    online_metadata,
    capacity,
    notes,
    schedule_occurrence_id,
    created_by_membership_id
  )
  values (
    new_session_id,
    org_id,
    target_course_version_id,
    btrim(target_title),
    target_organisational_unit_id,
    target_trainer_membership_id,
    target_trainer_name,
    target_scheduled_start,
    target_scheduled_end,
    target_location,
    target_online_metadata,
    target_capacity,
    target_notes,
    target_schedule_occurrence_id,
    actor_membership_id
  );

  perform private.enqueue_domain_event(
    org_id,
    new_session_id,
    'TrainingSessionCreated',
    new_session_id::text,
    jsonb_build_object('course_version_id', target_course_version_id)
  );

  return new_session_id;
end;
$$;

create or replace function private.add_training_session_participant(
  target_session_id uuid,
  target_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  new_participant_id uuid;
begin
  if org_id is null
    or not private.can_manage_training_sessions(org_id) then
    raise exception 'training session participant add is not authorised'
      using errcode = '42501';
  end if;

  insert into public.training_session_participants (
    organisation_id,
    session_id,
    membership_id
  )
  values (org_id, target_session_id, target_membership_id)
  returning id into new_participant_id;

  return new_participant_id;
end;
$$;

create or replace function public.create_training_session(
  target_course_version_id uuid,
  target_title text,
  target_organisational_unit_id uuid default null,
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_scheduled_start timestamptz default null,
  target_scheduled_end timestamptz default null,
  target_location text default null,
  target_online_metadata jsonb default null,
  target_capacity integer default null,
  target_notes text default null,
  target_schedule_occurrence_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_training_session(
  target_course_version_id,
  target_title,
  target_organisational_unit_id,
  target_trainer_membership_id,
  target_trainer_name,
  target_scheduled_start,
  target_scheduled_end,
  target_location,
  target_online_metadata,
  target_capacity,
  target_notes,
  target_schedule_occurrence_id
) $$;

create or replace function public.add_training_session_participant(
  target_session_id uuid,
  target_membership_id uuid
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_training_session_participant(target_session_id, target_membership_id) $$;

grant execute on function public.create_training_session(
  uuid, text, uuid, uuid, text, timestamptz, timestamptz, text, jsonb, integer, text, uuid
) to authenticated;
grant execute on function public.add_training_session_participant(uuid, uuid) to authenticated;

revoke all on function public.create_training_session(
  uuid, text, uuid, uuid, text, timestamptz, timestamptz, text, jsonb, integer, text, uuid
) from public, anon;
revoke all on function public.add_training_session_participant(uuid, uuid) from public, anon;

alter function private.create_training_session(
  uuid, text, uuid, uuid, text, timestamptz, timestamptz, text, jsonb, integer, text, uuid
) owner to lean_hub_private_owner;
alter function private.add_training_session_participant(uuid, uuid) owner to lean_hub_private_owner;
