-- BILLING-12: settle from reservation rate_snapshot (immutable at reserve); never live card at settle.

create or replace function private.leanai_rate_snapshot_is_valid(target_snapshot jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  provider_currency text;
  reporting_currency text;
  fx_micro bigint;
begin
  if target_snapshot is null or jsonb_typeof(target_snapshot) <> 'object' then
    return false;
  end if;

  if not (
    target_snapshot ? 'input_micro_per_million'
    and target_snapshot ? 'output_micro_per_million'
    and target_snapshot ? 'cached_input_micro_per_million'
    and target_snapshot ? 'output_includes_reasoning'
    and target_snapshot ? 'micro_gbp_per_credit'
    and target_snapshot ? 'card_version'
    and target_snapshot ? 'provider'
    and target_snapshot ? 'model'
  ) then
    return false;
  end if;

  if (target_snapshot->>'micro_gbp_per_credit')::bigint is null
    or (target_snapshot->>'micro_gbp_per_credit')::bigint <= 0 then
    return false;
  end if;

  provider_currency := coalesce(target_snapshot->>'provider_currency', 'GBP');
  reporting_currency := coalesce(target_snapshot->>'reporting_currency', 'GBP');
  fx_micro := nullif(target_snapshot->>'fx_reporting_micro_per_provider_micro', '')::bigint;

  if provider_currency = reporting_currency then
    return true;
  end if;

  return fx_micro is not null and fx_micro > 0;
end;
$$;

create or replace function private.leanai_reporting_micro_from_rate_snapshot(
  target_snapshot jsonb,
  target_input_tokens integer,
  target_output_tokens integer,
  target_cached_input_tokens integer,
  target_reasoning_tokens integer
)
returns bigint
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  cached_tokens integer;
  billable_input integer;
  output_tokens integer;
  reasoning_tokens integer;
  output_billable integer;
  provider_micro bigint;
  fx_micro bigint;
  provider_currency text;
  reporting_currency text;
  output_includes_reasoning boolean;
  reasoning_micro bigint;
begin
  if not private.leanai_rate_snapshot_is_valid(target_snapshot) then
    return null;
  end if;

  provider_currency := coalesce(target_snapshot->>'provider_currency', 'GBP');
  reporting_currency := coalesce(target_snapshot->>'reporting_currency', 'GBP');
  fx_micro := coalesce(
    nullif(target_snapshot->>'fx_reporting_micro_per_provider_micro', '')::bigint,
    case when provider_currency = reporting_currency then 1000000::bigint else null end
  );

  if fx_micro is null then
    return null;
  end if;

  output_includes_reasoning := coalesce(
    (target_snapshot->>'output_includes_reasoning')::boolean,
    true
  );
  reasoning_micro := coalesce(
    nullif(target_snapshot->>'reasoning_micro_per_million', '')::bigint,
    0
  );

  cached_tokens := greatest(0, coalesce(target_cached_input_tokens, 0));
  billable_input := greatest(0, coalesce(target_input_tokens, 0) - cached_tokens);
  output_tokens := greatest(0, coalesce(target_output_tokens, 0));
  reasoning_tokens := greatest(0, coalesce(target_reasoning_tokens, 0));

  if output_includes_reasoning and reasoning_tokens > 0 then
    output_billable := greatest(0, output_tokens - reasoning_tokens);
  else
    output_billable := output_tokens;
  end if;

  provider_micro :=
    (billable_input::bigint * (target_snapshot->>'input_micro_per_million')::bigint) / 1000000
    + (cached_tokens::bigint * (target_snapshot->>'cached_input_micro_per_million')::bigint) / 1000000
    + (output_billable::bigint * (target_snapshot->>'output_micro_per_million')::bigint) / 1000000
    + (reasoning_tokens::bigint * reasoning_micro) / 1000000;

  return (provider_micro * fx_micro) / 1000000;
end;
$$;

create or replace function private.leanai_cost_credits_from_rate_snapshot(
  target_snapshot jsonb,
  target_input_tokens integer,
  target_output_tokens integer,
  target_cached_input_tokens integer,
  target_reasoning_tokens integer
)
returns bigint
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  reporting_micro bigint;
  micro_per_credit bigint;
begin
  reporting_micro := private.leanai_reporting_micro_from_rate_snapshot(
    target_snapshot,
    target_input_tokens,
    target_output_tokens,
    target_cached_input_tokens,
    target_reasoning_tokens
  );

  if reporting_micro is null then
    return null;
  end if;

  micro_per_credit := (target_snapshot->>'micro_gbp_per_credit')::bigint;

  return case
    when coalesce(reporting_micro, 0) <= 0 then 0::bigint
    else (reporting_micro + micro_per_credit - 1) / micro_per_credit
  end;
end;
$$;

create or replace function private.ai_credit_settle_from_run_usage(
  target_ai_run_id uuid,
  target_input_tokens integer,
  target_output_tokens integer,
  target_cached_input_tokens integer,
  target_reasoning_tokens integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  reservation_row public.organisation_ai_credit_reservations%rowtype;
  actual_credits bigint;
  enforced boolean;
  snapshot jsonb;
begin
  if org_id is null then
    return;
  end if;

  enforced := private.leanai_credit_policy_enforced(org_id);

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
  for update;

  if not found then
    update public.ai_runs run_table
    set credit_accounting_status = case
      when enforced then 'incomplete'
      else 'not_enforced'
    end
    where run_table.id = target_ai_run_id;
    return;
  end if;

  snapshot := reservation_row.rate_snapshot;

  if reservation_row.status <> 'reserved' then
    return;
  end if;

  if not private.leanai_rate_snapshot_is_valid(snapshot) then
    update public.organisation_ai_credit_reservations reservation_table
    set settle_cost_unknown = true
    where reservation_table.id = reservation_row.id;

    update public.ai_runs run_table
    set credit_accounting_status = case
      when enforced then 'unknown_rate'
      else 'not_enforced'
    end
    where run_table.id = target_ai_run_id;

    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
    return;
  end if;

  actual_credits := private.leanai_cost_credits_from_rate_snapshot(
    snapshot,
    target_input_tokens,
    target_output_tokens,
    target_cached_input_tokens,
    target_reasoning_tokens
  );

  if actual_credits is null then
    update public.organisation_ai_credit_reservations reservation_table
    set settle_cost_unknown = true
    where reservation_table.id = reservation_row.id;

    update public.ai_runs run_table
    set credit_accounting_status = case
      when enforced then 'unknown_rate'
      else 'not_enforced'
    end
    where run_table.id = target_ai_run_id;

    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
    return;
  end if;

  update public.organisation_ai_credit_reservations reservation_table
  set rate_card_version = snapshot->>'card_version',
      actual_provider_credits = actual_credits,
      overrun_credits = greatest(0, actual_credits - reservation_row.reserved_credits)
  where reservation_table.id = reservation_row.id;

  if not enforced then
    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
    update public.ai_runs run_table
    set credit_accounting_status = 'not_enforced'
    where run_table.id = target_ai_run_id;
    return;
  end if;

  perform private.ai_credit_settle(target_ai_run_id, actual_credits);
end;
$$;

create or replace function private.sweep_stale_leanai_credit_reservations(
  target_max_age interval default interval '4 hours'
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  released_count integer := 0;
  reservation_row record;
  did_release boolean;
begin
  for reservation_row in
    select reservation_table.*
    from public.organisation_ai_credit_reservations reservation_table
    join public.ai_runs run_table
      on run_table.organisation_id = reservation_table.organisation_id
     and run_table.id = reservation_table.ai_run_id
    where reservation_table.status = 'reserved'
      and (
        run_table.status in ('failed', 'cancelled', 'timed_out', 'denied')
        or (
          run_table.status = 'running'
          and run_table.started_at < statement_timestamp() - target_max_age
        )
      )
  loop
    did_release := private.ai_credit_release_for_organisation(
      reservation_row.organisation_id,
      reservation_row.ai_run_id
    );
    if did_release then
      released_count := released_count + 1;
    end if;
  end loop;

  return released_count;
end;
$$;

revoke all on function private.leanai_rate_snapshot_is_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.leanai_reporting_micro_from_rate_snapshot(jsonb, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.leanai_cost_credits_from_rate_snapshot(jsonb, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function private.leanai_rate_snapshot_is_valid(jsonb)
  to lean_hub_private_owner;
grant execute on function private.leanai_reporting_micro_from_rate_snapshot(jsonb, integer, integer, integer, integer)
  to lean_hub_private_owner;
grant execute on function private.leanai_cost_credits_from_rate_snapshot(jsonb, integer, integer, integer, integer)
  to lean_hub_private_owner;
