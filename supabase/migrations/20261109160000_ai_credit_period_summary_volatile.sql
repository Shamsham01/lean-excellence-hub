-- get_organisation_ai_credit_period_summary allocates the current period via
-- private.ensure_organisation_ai_credit_period (FOR UPDATE). Mark volatile so
-- Postgres does not run it inside a read-only STABLE snapshot (settings UI).

create or replace function public.get_organisation_ai_credit_period_summary()
returns table (
  period_start timestamptz,
  period_end timestamptz,
  allowance_credits bigint,
  reserved_credits bigint,
  consumed_credits bigint,
  remaining_credits bigint,
  enforcement_enabled boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  period_id uuid;
begin
  if org_id is null then
    return;
  end if;

  period_id := private.ensure_organisation_ai_credit_period(org_id);

  return query
  select
    period_table.period_start,
    period_table.period_end,
    period_table.allowance_credits,
    period_table.reserved_credits,
    period_table.consumed_credits,
    greatest(
      0::bigint,
      period_table.allowance_credits
        - period_table.reserved_credits
        - period_table.consumed_credits
    ),
    private.leanai_credit_policy_enforced(org_id)
  from public.organisation_ai_credit_periods period_table
  where period_table.id = period_id;
end;
$$;

revoke all on function public.get_organisation_ai_credit_period_summary()
  from public, anon, service_role;
grant execute on function public.get_organisation_ai_credit_period_summary()
  to authenticated;
