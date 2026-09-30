-- SEC-RPC-002: eliminate authenticated SECURITY DEFINER advisor deltas for
-- billing and contextual LeanAI public RPCs (#191, #182, #187).
--
-- Lint 0029 (authenticated_security_definer_function_executable) fires when a
-- SECURITY DEFINER function in an exposed PostgREST schema is executable by
-- authenticated. These five public wrappers were the hosted 266 → 261 delta.
--
-- Architecture (matches existing founding/billing INVOKER wrappers):
--   public SECURITY INVOKER API
--     → private SECURITY DEFINER helper owned by lean_hub_private_owner
--
-- Authenticated EXECUTE on the private helpers is required because the public
-- wrappers are SECURITY INVOKER. That grant does not expose the helpers
-- through the Data API: `private` is not in PostgREST db.schemas
-- (config.toml: public, graphql_public). Lint 0029 only inspects exposed
-- schemas, so these grants do not create a replacement advisor finding.
--
-- Do not apply this migration to hosted Supabase from this change.

-- ---------------------------------------------------------------------------
-- Billing: move privileged lifecycle-aware read into private
-- ---------------------------------------------------------------------------

create or replace function private.get_current_organisation_billing()
returns table (
  organisation_id uuid,
  provider text,
  provider_customer_id text,
  plan_code text,
  billing_interval text,
  site_quantity integer,
  billing_state text,
  provider_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  grace_expires_at timestamptz,
  ended_at timestamptz,
  retention_eligible_at timestamptz,
  paid_site_limit integer,
  active_site_count integer,
  organisation_status text,
  onboarding_required boolean,
  intended_site_quantity integer,
  open_checkout_session_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organisation.id,
    account.provider,
    account.provider_customer_id,
    subscription.plan_code,
    subscription.billing_interval,
    subscription.site_quantity,
    subscription.billing_state,
    subscription.provider_status,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.cancel_at_period_end,
    subscription.grace_expires_at,
    subscription.ended_at,
    subscription.retention_eligible_at,
    private.organisation_paid_site_limit(organisation.id),
    private.count_active_billable_sites(organisation.id),
    private.effective_organisation_access_status(
      organisation.status,
      organisation.id
    ),
    organisation.onboarding_required,
    account.intended_site_quantity,
    account.open_checkout_session_id
  from public.organisations organisation
  left join public.organisation_billing_accounts account
    on account.organisation_id = organisation.id
  left join public.organisation_subscriptions subscription
    on subscription.organisation_id = organisation.id
  where organisation.id = private.current_organisation_id()
    and private.current_lifecycle_membership_id(organisation.id) is not null
$$;

create or replace function public.get_current_organisation_billing()
returns table (
  organisation_id uuid,
  provider text,
  provider_customer_id text,
  plan_code text,
  billing_interval text,
  site_quantity integer,
  billing_state text,
  provider_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  grace_expires_at timestamptz,
  ended_at timestamptz,
  retention_eligible_at timestamptz,
  paid_site_limit integer,
  active_site_count integer,
  organisation_status text,
  onboarding_required boolean,
  intended_site_quantity integer,
  open_checkout_session_id text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_current_organisation_billing()
$$;

-- ---------------------------------------------------------------------------
-- LeanAI: keep privileged implementation private; public wrappers become INVOKER
-- ---------------------------------------------------------------------------

create or replace function public.record_leanai_semantic_event(
  target_event_key text,
  target_event_version integer default 1,
  target_module_key text default null,
  target_intervention_key text default null,
  target_site_unit_id uuid default null,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_leanai_semantic_event(
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    target_site_unit_id,
    target_metadata,
    target_occurred_at
  )
$$;

create or replace function public.get_leanai_journey_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leanai_journey_context()
$$;

create or replace function public.get_organisation_setup_readiness()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.evaluate_organisation_setup_readiness()
$$;

create or replace function public.get_leanai_contextual_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leanai_contextual_snapshot()
$$;

-- ---------------------------------------------------------------------------
-- Ownership and least-privilege grants
-- ---------------------------------------------------------------------------

alter function private.get_current_organisation_billing()
  owner to lean_hub_private_owner;

revoke all on function private.get_current_organisation_billing()
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_organisation_billing()
  from public, anon, authenticated, service_role;

revoke all on function private.record_leanai_semantic_event(
  text, integer, text, text, uuid, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.get_leanai_journey_context()
  from public, anon, authenticated, service_role;
revoke all on function private.evaluate_organisation_setup_readiness()
  from public, anon, authenticated, service_role;
revoke all on function private.get_leanai_contextual_snapshot()
  from public, anon, authenticated, service_role;

revoke all on function public.record_leanai_semantic_event(
  text, integer, text, text, uuid, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.get_leanai_journey_context()
  from public, anon, authenticated, service_role;
revoke all on function public.get_organisation_setup_readiness()
  from public, anon, authenticated, service_role;
revoke all on function public.get_leanai_contextual_snapshot()
  from public, anon, authenticated, service_role;

grant execute on function public.get_current_organisation_billing()
  to authenticated;
grant execute on function public.record_leanai_semantic_event(
  text, integer, text, text, uuid, jsonb, timestamptz
) to authenticated;
grant execute on function public.get_leanai_journey_context()
  to authenticated;
grant execute on function public.get_organisation_setup_readiness()
  to authenticated;
grant execute on function public.get_leanai_contextual_snapshot()
  to authenticated;

grant execute on function private.get_current_organisation_billing()
  to authenticated, lean_hub_private_owner;
grant execute on function private.record_leanai_semantic_event(
  text, integer, text, text, uuid, jsonb, timestamptz
) to authenticated, lean_hub_private_owner;
grant execute on function private.get_leanai_journey_context()
  to authenticated, lean_hub_private_owner;
grant execute on function private.evaluate_organisation_setup_readiness()
  to authenticated, lean_hub_private_owner;
grant execute on function private.get_leanai_contextual_snapshot()
  to authenticated, lean_hub_private_owner;
