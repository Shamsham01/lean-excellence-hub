create or replace function private.remove_gemba_definition(target_definition_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  org uuid := private.current_organisation_id();
  actor uuid := private.current_membership_id(org);
begin
  if actor is null or not coalesce(private.membership_can_author_gemba_definition(org, actor, target_definition_id), false) then
    raise exception 'Definition management is not authorised' using errcode='42501';
  end if;
  perform 1 from public.gemba_definitions where organisation_id=org and id=target_definition_id for update;
  if not found then raise exception 'Definition not found' using errcode='42501'; end if;
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

create or replace function public.remove_gemba_definition(target_definition_id uuid)
returns text language sql volatile security definer set search_path = '' as $$
  select private.remove_gemba_definition(target_definition_id)
$$;
alter function public.remove_gemba_definition(uuid) owner to postgres;

create or replace function public.save_gemba_prompt_capture(
  target_walk_id uuid, target_question_id uuid, target_text_value text,
  target_is_not_applicable boolean, target_observation_type text, target_create_observation boolean
)
returns uuid language sql volatile security definer set search_path = '' as $$
  select private.save_gemba_prompt_capture(
    target_walk_id, target_question_id, target_text_value,
    target_is_not_applicable, target_observation_type, target_create_observation
  )
$$;
alter function public.save_gemba_prompt_capture(uuid, uuid, text, boolean, text, boolean) owner to postgres;

revoke execute on function
  private.remove_gemba_definition(uuid),
  private.save_gemba_prompt_capture(uuid, uuid, text, boolean, text, boolean)
from public, anon, authenticated, service_role;

revoke execute on function
  public.remove_gemba_definition(uuid),
  public.save_gemba_prompt_capture(uuid, uuid, text, boolean, text, boolean)
from public, anon, service_role;
grant execute on function
  public.remove_gemba_definition(uuid),
  public.save_gemba_prompt_capture(uuid, uuid, text, boolean, text, boolean)
to authenticated;

revoke execute on function
  private.schedule_calendar_state(public.schedule_definitions),
  private.enqueue_schedule_calendar_confirmation(),
  private.capture_gemba_action_evidence()
from service_role;
