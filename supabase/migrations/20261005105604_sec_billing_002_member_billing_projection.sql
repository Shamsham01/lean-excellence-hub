-- SEC-BILLING-002: minimise billing RPC fields visible to non-billing members
-- (#194).
--
-- Ordinary lifecycle members still need generic subscription state for
-- suspended/recovery, onboarding wait, and entitlement UI. They do not need
-- provider identifiers.
--
-- Architecture:
--   public.get_current_organisation_billing()
--     SECURITY INVOKER member-safe projection
--     → private.get_current_organisation_billing()
--   public.get_current_organisation_billing_management()
--     SECURITY INVOKER billing-authorised detail
--     → private.get_current_organisation_billing()
--     → private.current_can_manage_billing()
--
-- The private helper remains the privileged full-row read. It is not in
-- PostgREST db.schemas. Authenticated EXECUTE on that helper is unchanged
-- because the public wrappers are SECURITY INVOKER (SEC-RPC-002).
--
-- Do not apply this migration to hosted Supabase from this change.

drop function if exists public.get_current_organisation_billing();

create function public.get_current_organisation_billing()
returns table (
  organisation_id uuid,
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
  has_open_checkout boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    billing.organisation_id,
    billing.plan_code,
    billing.billing_interval,
    billing.site_quantity,
    billing.billing_state,
    billing.provider_status,
    billing.current_period_start,
    billing.current_period_end,
    billing.cancel_at_period_end,
    billing.grace_expires_at,
    billing.ended_at,
    billing.retention_eligible_at,
    billing.paid_site_limit,
    billing.active_site_count,
    billing.organisation_status,
    billing.onboarding_required,
    billing.intended_site_quantity,
    billing.open_checkout_session_id is not null
  from private.get_current_organisation_billing() billing
$$;

create function public.get_current_organisation_billing_management()
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
  select
    billing.organisation_id,
    billing.provider,
    billing.provider_customer_id,
    billing.plan_code,
    billing.billing_interval,
    billing.site_quantity,
    billing.billing_state,
    billing.provider_status,
    billing.current_period_start,
    billing.current_period_end,
    billing.cancel_at_period_end,
    billing.grace_expires_at,
    billing.ended_at,
    billing.retention_eligible_at,
    billing.paid_site_limit,
    billing.active_site_count,
    billing.organisation_status,
    billing.onboarding_required,
    billing.intended_site_quantity,
    billing.open_checkout_session_id
  from private.get_current_organisation_billing() billing
  where private.current_can_manage_billing()
$$;

revoke all on function public.get_current_organisation_billing()
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_organisation_billing_management()
  from public, anon, authenticated, service_role;

grant execute on function public.get_current_organisation_billing()
  to authenticated;
grant execute on function public.get_current_organisation_billing_management()
  to authenticated;
