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

  if not exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.organisation_id = org_id
      and attachment_row.id = target_attachment_id
      and attachment_row.target_resource_id = target_walk_id
      and attachment_row.lifecycle = 'active'
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

revoke all on function public.create_gemba_observation(
  uuid, text, text, uuid, uuid, text, text, uuid
) from public, anon;
revoke all on function public.update_gemba_observation(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.delete_gemba_observation(uuid, uuid)
  from public, anon;
revoke all on function public.delete_gemba_observations(uuid, uuid[])
  from public, anon;
