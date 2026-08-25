-- Training session participant management, course successor, and helpers.

create or replace function private.create_training_course_successor_version(
  target_course_id uuid
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
  source_version public.training_course_versions%rowtype;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course successor creation is not authorised'
      using errcode = '42501';
  end if;

  select version_row.*
  into source_version
  from public.training_course_versions version_row
  where version_row.organisation_id = org_id
    and version_row.course_id = target_course_id
    and version_row.status = 'published'
  order by version_row.version_number desc
  limit 1;

  if not found then
    raise exception 'published course version not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.training_course_versions draft_row
    where draft_row.organisation_id = org_id
      and draft_row.course_id = target_course_id
      and draft_row.status = 'draft'
  ) then
    raise exception 'draft course version already exists'
      using errcode = '55000';
  end if;

  insert into public.training_course_versions (
    organisation_id,
    course_id,
    version_number,
    status,
    duration_minutes,
    learning_objectives,
    validity_days,
    delivery_method,
    trainer_requirements,
    evidence_requirements,
    created_by_membership_id
  )
  values (
    org_id,
    target_course_id,
    source_version.version_number + 1,
    'draft',
    source_version.duration_minutes,
    source_version.learning_objectives,
    source_version.validity_days,
    source_version.delivery_method,
    source_version.trainer_requirements,
    source_version.evidence_requirements,
    actor_membership_id
  )
  returning id into new_version_id;

  return new_version_id;
end;
$$;

create or replace function private.update_training_session_participant_status(
  target_session_id uuid,
  target_participant_id uuid,
  target_status text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_manage_training_sessions(org_id) then
    raise exception 'training session participant update is not authorised'
      using errcode = '42501';
  end if;

  if target_status not in ('invited', 'attended', 'completed', 'absent', 'cancelled') then
    raise exception 'invalid participant status'
      using errcode = '22023';
  end if;

  update public.training_session_participants participant_row
  set
    status = target_status,
    updated_at = statement_timestamp()
  where participant_row.organisation_id = org_id
    and participant_row.session_id = target_session_id
    and participant_row.id = target_participant_id;

  if not found then
    raise exception 'session participant not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.remove_training_session_participant(
  target_session_id uuid,
  target_participant_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_training_session_participant_status(
    target_session_id,
    target_participant_id,
    'cancelled'
  )
$$;

create or replace function public.create_training_course_successor_version(target_course_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_training_course_successor_version(target_course_id) $$;

create or replace function public.update_training_session_participant_status(
  target_session_id uuid,
  target_participant_id uuid,
  target_status text
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.update_training_session_participant_status(
  target_session_id, target_participant_id, target_status
) $$;

create or replace function public.remove_training_session_participant(
  target_session_id uuid,
  target_participant_id uuid
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.remove_training_session_participant(target_session_id, target_participant_id) $$;

grant execute on function public.create_training_course_successor_version(uuid) to authenticated;
grant execute on function public.update_training_session_participant_status(uuid, uuid, text) to authenticated;
grant execute on function public.remove_training_session_participant(uuid, uuid) to authenticated;

revoke all on function public.create_training_course_successor_version(uuid) from public, anon;
revoke all on function public.update_training_session_participant_status(uuid, uuid, text) from public, anon;
revoke all on function public.remove_training_session_participant(uuid, uuid) from public, anon;

alter function private.create_training_course_successor_version(uuid) owner to lean_hub_private_owner;
alter function private.update_training_session_participant_status(uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.remove_training_session_participant(uuid, uuid) owner to lean_hub_private_owner;
