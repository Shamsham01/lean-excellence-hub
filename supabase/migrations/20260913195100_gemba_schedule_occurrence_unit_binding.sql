-- Issue #78 review follow-up: a Gemba walk started from a schedule
-- occurrence must use that occurrence's organisational unit.
-- Applicability alone is not enough — an authorised applicable unit must
-- not be paired with a different occurrence.
-- Does not backfill hosted data or broaden grants/RLS.

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
        and occurrence_row.unit_id = target_unit_id
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

alter function private.start_gemba_walk(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
