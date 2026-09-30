-- LEANAI-CONTEXT-03: include the organisation proactive-assistance flag in the
-- existing snapshot RPC. Replaces the current function; does not add a new
-- SECURITY DEFINER surface, grant, or anonymous execute path.

create or replace function private.get_leanai_contextual_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'leanai contextual snapshot is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'readiness', private.evaluate_organisation_setup_readiness(),
    'journey', private.get_leanai_journey_context(),
    'retention', jsonb_build_object(
      'event_retention_days', private.leanai_event_retention_days(org_id),
      'cleanup_available', true
    ),
    'proactive_assistance_enabled', coalesce(
      (
        select settings_row.proactive_assistance_enabled
        from public.organisation_ai_settings settings_row
        where settings_row.organisation_id = org_id
      ),
      true
    )
  );
end;
$$;

alter function private.get_leanai_contextual_snapshot() owner to lean_hub_private_owner;

revoke all on function private.get_leanai_contextual_snapshot() from public, anon, authenticated;
grant execute on function private.get_leanai_contextual_snapshot() to lean_hub_private_owner;
grant execute on function public.get_leanai_contextual_snapshot() to authenticated;
revoke all on function public.get_leanai_contextual_snapshot() from public, anon;
