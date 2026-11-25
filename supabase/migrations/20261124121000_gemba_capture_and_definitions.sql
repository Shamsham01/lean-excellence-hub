alter table public.gemba_walk_observations alter column observation_type drop not null;
alter table public.gemba_definitions add column archived_at timestamptz;

create function private.remove_gemba_definition(target_definition_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  org uuid := private.current_organisation_id();
  actor uuid := private.current_membership_id(org);
begin
  if actor is null or not coalesce(private.membership_can_author_gemba_definition(org, actor, target_definition_id), false) then
    raise exception 'Definition management is not authorised' using errcode='42501';
  end if;
  perform 1 from public.gemba_definitions where organisation_id=org and id=target_definition_id for update;
  if not found then raise exception 'Definition not found'; end if;
  perform 1 from public.gemba_definition_versions where definition_id=target_definition_id for update;
  if exists (select 1 from public.gemba_walks w join public.gemba_definition_versions v on v.id=w.definition_version_id
    where v.definition_id=target_definition_id)
    or exists(select 1 from public.schedule_definitions where activity_resource_id=target_definition_id) then
    update public.gemba_definitions set archived_at=statement_timestamp() where id=target_definition_id;
    update public.gemba_definition_versions set status='archived', archived_at=statement_timestamp() where definition_id=target_definition_id and status <> 'archived';
    return 'archived';
  end if;
  delete from public.gemba_definition_applicable_units where definition_id=target_definition_id;
  delete from public.gemba_definition_versions where definition_id=target_definition_id;
  delete from public.gemba_definitions where id=target_definition_id;
  return 'deleted';
end;
$$;
alter function private.remove_gemba_definition(uuid) owner to lean_hub_private_owner;
create function public.remove_gemba_definition(target_definition_id uuid) returns text
language sql volatile security invoker set search_path = '' as $$ select private.remove_gemba_definition(target_definition_id) $$;
revoke execute on function private.remove_gemba_definition(uuid), public.remove_gemba_definition(uuid) from public, anon;
grant execute on function private.remove_gemba_definition(uuid), public.remove_gemba_definition(uuid) to authenticated;

-- The question UUID is a stable, walk-scoped request key for its first observation.
create function private.save_gemba_prompt_capture(target_walk_id uuid,target_question_id uuid,target_text_value text,
  target_is_not_applicable boolean,target_observation_type text,target_create_observation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare org uuid := private.current_organisation_id(); observation uuid;
begin
  perform private.upsert_gemba_walk_answer(target_walk_id,target_question_id,target_is_not_applicable,target_text_value);
  select id into observation from public.gemba_walk_observations where organisation_id=org and walk_id=target_walk_id
    and question_id=target_question_id and client_request_id=target_question_id for update;
  if nullif(btrim(target_text_value),'') is not null and not target_is_not_applicable then
    if observation is null and (target_observation_type is not null or target_create_observation) then
      observation := private.create_gemba_observation(target_walk_id,target_text_value,target_observation_type,
        null,target_question_id,null,null,target_question_id);
    end if;
    if observation is not null then
      perform private.update_gemba_observation(target_walk_id,observation,target_text_value,target_observation_type);
    end if;
  elsif observation is not null then
    update public.gemba_walk_observations set observation_type=null where id=observation;
  end if;
  return observation;
end;
$$;
alter function private.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean) owner to lean_hub_private_owner;
create function public.save_gemba_prompt_capture(target_walk_id uuid,target_question_id uuid,target_text_value text,
  target_is_not_applicable boolean,target_observation_type text,target_create_observation boolean)
returns uuid language sql volatile security invoker set search_path = '' as $$
 select private.save_gemba_prompt_capture(target_walk_id,target_question_id,target_text_value,target_is_not_applicable,target_observation_type,target_create_observation)
$$;
revoke execute on function private.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean),public.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean) from public,anon;
grant execute on function private.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean),public.save_gemba_prompt_capture(uuid,uuid,text,boolean,text,boolean) to authenticated;

-- Snapshot existing attachment references atomically with the Gemba action.
create table public.gemba_action_evidence (
  organisation_id uuid not null,
  action_id uuid not null,
  attachment_id uuid not null,
  primary key(action_id, attachment_id),
  foreign key(organisation_id, action_id) references public.actions(organisation_id,id) on delete cascade,
  foreign key(organisation_id, attachment_id) references public.attachments(organisation_id,id) on delete cascade
);
alter table public.gemba_action_evidence enable row level security;
alter table public.gemba_action_evidence force row level security;
revoke all on public.gemba_action_evidence from public,anon,authenticated;
grant select on public.gemba_action_evidence to authenticated;
grant select, insert on public.gemba_action_evidence to lean_hub_private_owner;
create policy gemba_action_evidence_reader on public.gemba_action_evidence for select to authenticated
using (exists(select 1 from public.actions a where a.id=action_id)
  and exists(select 1 from public.attachments a where a.id=attachment_id));
create policy gemba_action_evidence_writer on public.gemba_action_evidence for insert to lean_hub_private_owner with check(true);
create function private.capture_gemba_action_evidence() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.gemba_action_evidence(organisation_id,action_id,attachment_id)
  select distinct new.organisation_id,new.action_id,e.attachment_id from public.gemba_evidence_links e
  where e.organisation_id=new.organisation_id and e.walk_id=new.walk_id and
     ((e.observation_id=new.observation_id) or
     (e.observation_id is null and e.question_id=new.question_id and (new.observation_id is null or exists(
       select 1 from public.gemba_walk_observations o where o.id=new.observation_id and o.walk_id=new.walk_id
       and o.question_id=new.question_id and o.client_request_id=new.question_id))));
  return new;
end;
$$;
revoke execute on function private.capture_gemba_action_evidence() from public,anon;
create trigger capture_gemba_action_evidence after insert on public.gemba_action_context
for each row execute function private.capture_gemba_action_evidence();
