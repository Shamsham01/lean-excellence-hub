-- In-progress Gemba observation update/delete lifecycle.
-- Clients keep SELECT-only table access. Mutations stay on security-definer RPCs.

alter table public.gemba_walk_observations
  add column if not exists client_request_id uuid;

create unique index if not exists gemba_walk_observations_walk_client_request_uidx
  on public.gemba_walk_observations (organisation_id, walk_id, client_request_id)
  where client_request_id is not null;

create or replace function private.normalize_gemba_observation_text(
  target_observation_text text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text := btrim(coalesce(target_observation_text, ''));
begin
  if trimmed = '' then
    raise exception 'gemba observation text is required'
      using errcode = '22023';
  end if;

  if char_length(trimmed) > 2000 then
    raise exception 'gemba observation text is too long'
      using errcode = '22023';
  end if;

  return trimmed;
end;
$$;

create or replace function private.assert_gemba_observation_type(
  target_observation_type text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if target_observation_type not in (
    'positive_practice', 'improvement_opportunity', 'issue'
  ) then
    raise exception 'invalid observation type'
      using errcode = '22023';
  end if;

  return target_observation_type;
end;
$$;

create or replace function private.require_editable_gemba_observation(
  target_walk_id uuid,
  target_observation_id uuid
)
returns public.gemba_walk_observations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  observation_row public.gemba_walk_observations%rowtype;
begin
  if org_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba observation change is not authorised'
      using errcode = '42501';
  end if;

  select observation_item.*
  into observation_row
  from public.gemba_walk_observations observation_item
  where observation_item.organisation_id = org_id
    and observation_item.id = target_observation_id
    and observation_item.walk_id = target_walk_id;

  if not found then
    raise exception 'gemba observation was not found on this walk'
      using errcode = 'P0002';
  end if;

  return observation_row;
end;
$$;

drop function if exists public.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text
);
drop function if exists private.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text
);

create function private.create_gemba_observation(
  target_walk_id uuid,
  target_observation_text text,
  target_observation_type text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null,
  target_client_request_id uuid default null
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
  observation_text text;
  observation_type text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba observation creation is not authorised'
      using errcode = '42501';
  end if;

  observation_text := private.normalize_gemba_observation_text(
    target_observation_text
  );
  observation_type := private.assert_gemba_observation_type(
    target_observation_type
  );

  if target_client_request_id is not null then
    select observation_item.id
    into new_observation_id
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.walk_id = target_walk_id
      and observation_item.client_request_id = target_client_request_id;

    if new_observation_id is not null then
      return new_observation_id;
    end if;
  end if;

  begin
    insert into public.gemba_walk_observations (
      organisation_id,
      walk_id,
      section_id,
      question_id,
      observation_text,
      observation_type,
      severity,
      priority,
      created_by_membership_id,
      client_request_id
    )
    values (
      org_id,
      target_walk_id,
      target_section_id,
      target_question_id,
      observation_text,
      observation_type,
      target_severity,
      target_priority,
      actor_membership_id,
      target_client_request_id
    )
    returning id into new_observation_id;
  exception
    when unique_violation then
      if target_client_request_id is null then
        raise;
      end if;

      select observation_item.id
      into new_observation_id
      from public.gemba_walk_observations observation_item
      where observation_item.organisation_id = org_id
        and observation_item.walk_id = target_walk_id
        and observation_item.client_request_id = target_client_request_id;

      if new_observation_id is null then
        raise;
      end if;

      return new_observation_id;
  end;

  perform private.enqueue_domain_event(
    org_id,
    target_walk_id,
    'GembaObservationCreated',
    new_observation_id::text,
    jsonb_build_object('observation_id', new_observation_id)
  );

  return new_observation_id;
end;
$$;

create function public.create_gemba_observation(
  target_walk_id uuid,
  target_observation_text text,
  target_observation_type text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_severity text default null,
  target_priority text default null,
  target_client_request_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_gemba_observation(
    target_walk_id,
    target_observation_text,
    target_observation_type,
    target_section_id,
    target_question_id,
    target_severity,
    target_priority,
    target_client_request_id
  )
$$;

create or replace function private.update_gemba_observation(
  target_walk_id uuid,
  target_observation_id uuid,
  target_observation_text text,
  target_observation_type text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  normalized_text text;
  normalized_type text;
begin
  perform private.require_editable_gemba_observation(
    target_walk_id,
    target_observation_id
  );

  normalized_text := private.normalize_gemba_observation_text(
    target_observation_text
  );
  normalized_type := private.assert_gemba_observation_type(
    target_observation_type
  );

  update public.gemba_walk_observations
  set observation_text = normalized_text,
      observation_type = normalized_type
  where organisation_id = org_id
    and id = target_observation_id
    and walk_id = target_walk_id;

  perform private.enqueue_domain_event(
    org_id,
    target_walk_id,
    'GembaObservationUpdated',
    target_observation_id::text,
    jsonb_build_object('observation_id', target_observation_id)
  );

  return true;
end;
$$;

create or replace function private.unlink_gemba_observation_evidence(
  target_organisation_id uuid,
  target_walk_id uuid,
  target_observation_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.gemba_action_context action_context
    where action_context.organisation_id = target_organisation_id
      and action_context.walk_id = target_walk_id
      and action_context.observation_id = any(target_observation_ids)
  ) then
    raise exception 'gemba observation is linked to an action and cannot be deleted'
      using errcode = '55000';
  end if;

  -- Drop observation-scoped evidence links only. Attachments stay owned by the
  -- walk resource so shared/walk-level files are not destroyed.
  delete from public.gemba_evidence_links
  where organisation_id = target_organisation_id
    and walk_id = target_walk_id
    and observation_id = any(target_observation_ids);
end;
$$;

create or replace function private.delete_gemba_observation(
  target_walk_id uuid,
  target_observation_id uuid
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
  perform private.require_editable_gemba_observation(
    target_walk_id,
    target_observation_id
  );

  perform private.unlink_gemba_observation_evidence(
    org_id,
    target_walk_id,
    array[target_observation_id]
  );

  delete from public.gemba_walk_observations
  where organisation_id = org_id
    and id = target_observation_id
    and walk_id = target_walk_id;

  perform private.enqueue_domain_event(
    org_id,
    target_walk_id,
    'GembaObservationDeleted',
    target_observation_id::text,
    jsonb_build_object('observation_id', target_observation_id)
  );

  return true;
end;
$$;

create or replace function private.delete_gemba_observations(
  target_walk_id uuid,
  target_observation_ids uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  requested_ids uuid[];
  deleted_count integer;
begin
  if org_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba observation deletion is not authorised'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct observation_id), array[]::uuid[])
  into requested_ids
  from unnest(coalesce(target_observation_ids, array[]::uuid[])) as observation_id
  where observation_id is not null;

  if coalesce(array_length(requested_ids, 1), 0) = 0 then
    raise exception 'gemba observation ids are required'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.walk_id = target_walk_id
      and observation_item.id = any(requested_ids)
  ) <> array_length(requested_ids, 1) then
    raise exception 'gemba observation deletion is not authorised'
      using errcode = '42501';
  end if;

  perform private.unlink_gemba_observation_evidence(
    org_id,
    target_walk_id,
    requested_ids
  );

  delete from public.gemba_walk_observations
  where organisation_id = org_id
    and walk_id = target_walk_id
    and id = any(requested_ids);

  get diagnostics deleted_count = row_count;

  perform private.enqueue_domain_event(
    org_id,
    target_walk_id,
    'GembaObservationsDeleted',
    target_walk_id::text,
    jsonb_build_object(
      'observation_ids', to_jsonb(requested_ids),
      'deleted_count', deleted_count
    )
  );

  return deleted_count;
end;
$$;

create or replace function public.update_gemba_observation(
  target_walk_id uuid,
  target_observation_id uuid,
  target_observation_text text,
  target_observation_type text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_gemba_observation(
    target_walk_id,
    target_observation_id,
    target_observation_text,
    target_observation_type
  )
$$;

create or replace function public.delete_gemba_observation(
  target_walk_id uuid,
  target_observation_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delete_gemba_observation(
    target_walk_id,
    target_observation_id
  )
$$;

create or replace function public.delete_gemba_observations(
  target_walk_id uuid,
  target_observation_ids uuid[]
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delete_gemba_observations(
    target_walk_id,
    target_observation_ids
  )
$$;

-- Attachment FORCE RLS is authenticated-only. Private Gemba helpers owned by
-- lean_hub_private_owner must validate via a postgres-owned reader, matching
-- private.attachment_is_active_in_organisation.
create or replace function private.attachment_is_active_for_resource(
  target_organisation_id uuid,
  expected_attachment_id uuid,
  expected_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.organisation_id = target_organisation_id
      and attachment_row.id = expected_attachment_id
      and attachment_row.target_resource_id = expected_resource_id
      and attachment_row.lifecycle = 'active'
  )
$$;

alter function private.attachment_is_active_for_resource(uuid, uuid, uuid)
  owner to postgres;

revoke all on function private.attachment_is_active_for_resource(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.attachment_is_active_for_resource(
  uuid, uuid, uuid
) to lean_hub_private_owner;

create or replace function private.link_gemba_evidence(
  target_walk_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null
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
  new_link_id uuid;
begin
  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba evidence link is not authorised'
      using errcode = '42501';
  end if;

  if not private.attachment_is_active_for_resource(
    org_id,
    target_attachment_id,
    target_walk_id
  ) then
    raise exception 'gemba evidence attachment is not valid for this walk'
      using errcode = '22023';
  end if;

  if target_observation_id is not null and not exists (
    select 1
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.id = target_observation_id
      and observation_item.walk_id = target_walk_id
  ) then
    raise exception 'gemba observation does not belong to this walk'
      using errcode = '22023';
  end if;

  insert into public.gemba_evidence_links (
    organisation_id,
    walk_id,
    attachment_id,
    section_id,
    question_id,
    observation_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_walk_id,
    target_attachment_id,
    target_section_id,
    target_question_id,
    target_observation_id,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function public.link_gemba_evidence(
  target_walk_id uuid,
  target_attachment_id uuid,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.link_gemba_evidence(
    target_walk_id,
    target_attachment_id,
    target_section_id,
    target_question_id,
    target_observation_id
  )
$$;

grant execute on function public.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text, uuid
) to authenticated;
grant execute on function public.update_gemba_observation(
  uuid, uuid, text, text
) to authenticated;
grant execute on function public.delete_gemba_observation(uuid, uuid)
  to authenticated;
grant execute on function public.delete_gemba_observations(uuid, uuid[])
  to authenticated;
grant execute on function public.link_gemba_evidence(
  uuid, uuid, uuid, uuid, uuid
) to authenticated;

revoke all on function public.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text, uuid
) from public, anon;
revoke all on function public.update_gemba_observation(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.delete_gemba_observation(uuid, uuid)
  from public, anon;
revoke all on function public.delete_gemba_observations(uuid, uuid[])
  from public, anon;
revoke all on function public.link_gemba_evidence(
  uuid, uuid, uuid, uuid, uuid
) from public, anon;

create or replace function private.count_unanswered_required_gemba_questions(
  target_organisation_id uuid,
  target_walk_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.gemba_walks walk_row
  join public.gemba_definition_versions version_row
    on version_row.organisation_id = walk_row.organisation_id
   and version_row.id = walk_row.definition_version_id
  join public.template_questions question_row
    on question_row.organisation_id = walk_row.organisation_id
   and question_row.template_version_id = version_row.template_version_id
  left join public.template_answers answer_row
    on answer_row.organisation_id = walk_row.organisation_id
   and answer_row.submission_id = walk_row.submission_id
   and answer_row.question_id = question_row.id
  where walk_row.organisation_id = target_organisation_id
    and walk_row.id = target_walk_id
    and question_row.is_required = true
    and not (
      (
        coalesce(answer_row.is_not_applicable, false)
        and question_row.allows_not_applicable
      )
      or nullif(btrim(coalesce(answer_row.text_value, '')), '') is not null
      or answer_row.number_value is not null
      or answer_row.date_value is not null
      or answer_row.json_value is not null
    )
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

  if private.count_unanswered_required_gemba_questions(
    org_id,
    target_walk_id
  ) > 0 then
    raise exception 'required gemba walk questions are unanswered'
      using errcode = '55000';
  end if;

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

alter function private.normalize_gemba_observation_text(text)
  owner to lean_hub_private_owner;
alter function private.assert_gemba_observation_type(text)
  owner to lean_hub_private_owner;
alter function private.require_editable_gemba_observation(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text, uuid
)
  owner to lean_hub_private_owner;
alter function private.update_gemba_observation(uuid, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.unlink_gemba_observation_evidence(uuid, uuid, uuid[])
  owner to lean_hub_private_owner;
alter function private.delete_gemba_observation(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.delete_gemba_observations(uuid, uuid[])
  owner to lean_hub_private_owner;
alter function private.link_gemba_evidence(uuid, uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.count_unanswered_required_gemba_questions(uuid, uuid)
  owner to lean_hub_private_owner;

revoke all on function private.normalize_gemba_observation_text(text)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_gemba_observation_type(text)
  from public, anon, authenticated, service_role;
revoke all on function private.require_editable_gemba_observation(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text, uuid
)
  from public, anon, authenticated, service_role;
revoke all on function private.update_gemba_observation(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.unlink_gemba_observation_evidence(
  uuid, uuid, uuid[]
)
  from public, anon, authenticated, service_role;
revoke all on function private.delete_gemba_observation(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.delete_gemba_observations(uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function private.link_gemba_evidence(
  uuid, uuid, uuid, uuid, uuid
)
  from public, anon, authenticated, service_role;
revoke all on function private.count_unanswered_required_gemba_questions(
  uuid, uuid
)
  from public, anon, authenticated, service_role;
