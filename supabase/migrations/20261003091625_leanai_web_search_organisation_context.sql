-- LEANAI-WEB-01: organisation-admin opt-in for LeanAI public web research.
-- Default is false: external search leaves the internal-only context boundary
-- and has incremental provider cost. Do not apply this migration to hosted
-- Supabase until explicitly approved.

alter table public.organisation_ai_settings
  add column if not exists web_search_enabled boolean not null default false;

comment on column public.organisation_ai_settings.web_search_enabled is
  'When true, the persistent LeanAI workspace assistant may use the OpenAI Responses web_search tool. Default false: organisation admins must opt in.';

-- Recreate the settings RPC as a single 3-argument signature so PostgREST
-- cannot resolve an ambiguous 2-arg / 3-arg overload pair.
drop function if exists public.update_organisation_ai_settings(boolean, integer);
drop function if exists private.update_organisation_ai_settings(boolean, integer);

create function private.update_organisation_ai_settings(
  target_ai_enabled boolean,
  target_monthly_token_ceiling integer default null,
  target_web_search_enabled boolean default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ai_settings(org_id) then
    raise exception 'ai settings update is not authorised'
      using errcode = '42501';
  end if;

  if target_monthly_token_ceiling is not null
    and target_monthly_token_ceiling <= 0 then
    raise exception 'invalid monthly token ceiling'
      using errcode = '22023';
  end if;

  update public.organisation_ai_settings
  set ai_enabled = target_ai_enabled,
      monthly_token_ceiling = target_monthly_token_ceiling,
      web_search_enabled = coalesce(
        target_web_search_enabled,
        web_search_enabled
      ),
      updated_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where organisation_id = org_id;

  if not found then
    insert into public.organisation_ai_settings (
      organisation_id,
      ai_enabled,
      monthly_token_ceiling,
      web_search_enabled,
      updated_by_membership_id
    )
    values (
      org_id,
      target_ai_enabled,
      target_monthly_token_ceiling,
      coalesce(target_web_search_enabled, false),
      actor_membership_id
    );
  end if;
end;
$$;

create function public.update_organisation_ai_settings(
  target_ai_enabled boolean,
  target_monthly_token_ceiling integer default null,
  target_web_search_enabled boolean default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_organisation_ai_settings(
    target_ai_enabled,
    target_monthly_token_ceiling,
    target_web_search_enabled
  )
$$;

alter function private.update_organisation_ai_settings(
  boolean,
  integer,
  boolean
) owner to lean_hub_private_owner;

grant execute on function public.update_organisation_ai_settings(
  boolean,
  integer,
  boolean
) to authenticated;
revoke all on function public.update_organisation_ai_settings(
  boolean,
  integer,
  boolean
) from public, anon;
revoke all on function private.update_organisation_ai_settings(
  boolean,
  integer,
  boolean
) from public, anon, authenticated, service_role;
grant execute on function private.update_organisation_ai_settings(
  boolean,
  integer,
  boolean
) to lean_hub_private_owner;

-- Expose the capability on the existing snapshot so ai.use members can learn
-- the organisation policy without reading organisation_ai_settings (SELECT is
-- restricted to ai.manage_settings).
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
    ),
    'web_search_enabled', coalesce(
      (
        select settings_row.web_search_enabled
        from public.organisation_ai_settings settings_row
        where settings_row.organisation_id = org_id
      ),
      false
    )
  );
end;
$$;

alter function private.get_leanai_contextual_snapshot() owner to lean_hub_private_owner;

revoke all on function private.get_leanai_contextual_snapshot() from public, anon, authenticated;
grant execute on function private.get_leanai_contextual_snapshot() to lean_hub_private_owner;
grant execute on function public.get_leanai_contextual_snapshot() to authenticated;
revoke all on function public.get_leanai_contextual_snapshot() from public, anon;
