create index gemba_action_evidence_attachment_idx on public.gemba_action_evidence (organisation_id, attachment_id);

create function private.can_read_gemba_action_evidence(target_organisation_id uuid, target_attachment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_organisation_id = private.current_organisation_id() and exists (
    select 1 from public.gemba_action_evidence link
    where link.organisation_id = target_organisation_id
      and link.attachment_id = target_attachment_id
      and private.can_read_action(target_organisation_id, link.action_id)
  )
$$;
alter function private.can_read_gemba_action_evidence(uuid, uuid) owner to lean_hub_private_owner;
revoke execute on function private.can_read_gemba_action_evidence(uuid, uuid) from public, anon;
grant execute on function private.can_read_gemba_action_evidence(uuid, uuid) to authenticated;

-- The helper reads links without re-entering the attachment metadata policy.
create policy gemba_action_evidence_private_read on public.gemba_action_evidence
for select to lean_hub_private_owner using (true);

alter policy gemba_action_evidence_reader on public.gemba_action_evidence using (
  organisation_id = private.current_organisation_id()
  and private.can_read_action(organisation_id, action_id)
  and exists (select 1 from public.attachments a where a.id = attachment_id)
);

alter policy attachments_select_active on public.attachments using (
  organisation_id = private.current_organisation_id() and lifecycle = 'active'
  and (
    (private.can_access_attachment_target(organisation_id, id)
      and (private.has_scoped_permission(organisation_id, 'attachments.read', null, null)
        or private.can_read_suggestion_evidence(organisation_id, target_resource_id)))
    or (private.has_scoped_permission(organisation_id, 'attachments.read', null, null)
      and private.can_read_gemba_action_evidence(organisation_id, id))
  )
);

-- SELECT on attachments is evaluated as the requesting authenticated user.
alter policy organisation_evidence_read on storage.objects using (
  bucket_id = 'organisation-evidence' and exists (
    select 1 from public.attachments a
    where a.storage_object_path = name and a.lifecycle = 'active'
      and a.organisation_id = private.current_organisation_id()
  )
);

create or replace function private.save_gemba_prompt_capture(
  target_walk_id uuid, target_question_id uuid, target_text_value text,
  target_is_not_applicable boolean, target_observation_type text, target_create_observation boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  org uuid := private.current_organisation_id();
  observation uuid;
  capture_text text := nullif(btrim(target_text_value), '');
  has_photo boolean;
  prompt_section uuid;
begin
  perform private.upsert_gemba_walk_answer(target_walk_id, target_question_id, target_is_not_applicable, target_text_value);
  select o.id into observation from public.gemba_walk_observations o
    where o.organisation_id = org and o.walk_id = target_walk_id and o.question_id = target_question_id
      and o.client_request_id = target_question_id for update;
  select exists (
    select 1 from public.gemba_evidence_links e where e.organisation_id = org and e.walk_id = target_walk_id
      and (e.observation_id = observation or (e.observation_id is null and e.question_id = target_question_id))
  ) into has_photo;

  if target_is_not_applicable then capture_text := null; end if;
  if capture_text is null and has_photo and target_create_observation then
    select left(q.prompt, 2000) into capture_text from public.template_questions q
      where q.organisation_id = org and q.id = target_question_id;
  end if;
  if capture_text is not null then
    if observation is null and (target_observation_type is not null or target_create_observation) then
      select q.section_id into strict prompt_section from public.template_questions q
        where q.organisation_id = org and q.id = target_question_id;
      observation := private.create_gemba_observation(target_walk_id, capture_text, target_observation_type,
        prompt_section, target_question_id, null, null, target_question_id);
    elsif observation is not null then
      perform private.update_gemba_observation(target_walk_id, observation, capture_text, target_observation_type);
    end if;
  elsif observation is not null then
    if not has_photo and not exists (
      select 1 from public.gemba_action_context c where c.organisation_id = org and c.observation_id = observation
    ) then
      perform private.delete_gemba_observation(target_walk_id, observation);
      observation := null;
    else
      update public.gemba_walk_observations set observation_type = null where id = observation;
    end if;
  end if;
  return observation;
end;
$$;
revoke execute on function private.save_gemba_prompt_capture(uuid, uuid, text, boolean, text, boolean) from public, anon;
