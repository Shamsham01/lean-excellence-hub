-- BILLING-10: unify 1 credit = 1000 micro-GBP (£0.001); settlement clamp; accounting incomplete;
-- rate-card FX/currency; reserve from configured caps (not user message length).

create or replace function private.leanai_micro_gbp_per_credit()
returns bigint
language sql
immutable
security definer
set search_path = ''
as $$
  select 1000::bigint
$$;

revoke all on function private.leanai_micro_gbp_per_credit() from public, anon, authenticated, service_role;
grant execute on function private.leanai_micro_gbp_per_credit() to lean_hub_private_owner;

alter table private.leanai_provider_rate_cards
  add column if not exists provider_currency text not null default 'GBP',
  add column if not exists fx_reporting_micro_per_provider_micro bigint not null default 1000000,
  add column if not exists rate_source text,
  add column if not exists rate_observed_at timestamptz,
  add column if not exists output_includes_reasoning boolean not null default true,
  add column if not exists reserve_max_tool_hops integer not null default 4,
  add column if not exists reserve_tool_input_tokens_per_hop integer not null default 512;

comment on column private.leanai_provider_rate_cards.fx_reporting_micro_per_provider_micro is
  'Multiply provider-currency micro-units by this / 1_000_000 for reporting_currency micro-units (provisional FX).';

update private.leanai_provider_rate_cards
set
  provider_currency = 'GBP',
  fx_reporting_micro_per_provider_micro = 1000000,
  rate_source = 'internal-provisional-fake',
  rate_observed_at = timestamptz '2026-11-08 00:00:00+00',
  output_includes_reasoning = true,
  reasoning_micro_per_million = 0,
  reserve_max_tool_hops = 2,
  reserve_tool_input_tokens_per_hop = 512
where provider = 'fake' and model = 'fake-model';

update private.leanai_provider_rate_cards
set
  provider_currency = 'USD',
  fx_reporting_micro_per_provider_micro = 790000,
  rate_source = 'internal-provisional-unverified-openai-listing',
  rate_observed_at = timestamptz '2026-11-08 00:00:00+00',
  output_includes_reasoning = true,
  reasoning_micro_per_million = 0,
  input_micro_per_million = 400000,
  output_micro_per_million = 1600000,
  cached_input_micro_per_million = 100000,
  reserve_max_tool_hops = 4,
  reserve_tool_input_tokens_per_hop = 512
where provider = 'openai' and model = 'gpt-4.1-mini';

delete from private.leanai_provider_rate_cards
where (provider, model) not in (
  ('fake', 'fake-model'),
  ('openai', 'gpt-4.1-mini')
);

alter table public.organisation_ai_credit_reservations
  add column if not exists rate_snapshot jsonb,
  add column if not exists actual_provider_credits bigint,
  add column if not exists customer_settled_credits bigint;

alter table public.ai_runs
  add column if not exists credit_accounting_status text not null default 'pending';

alter table public.ai_runs
  drop constraint if exists ai_runs_credit_accounting_status_check;

alter table public.ai_runs
  add constraint ai_runs_credit_accounting_status_check
  check (
    credit_accounting_status in (
      'pending',
      'not_enforced',
      'reserved',
      'settled',
      'released',
      'incomplete',
      'unknown_rate'
    )
  );

create or replace function private.leanai_reporting_micro_from_tokens(
  target_rate_card private.leanai_provider_rate_cards,
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
begin
  cached_tokens := greatest(0, coalesce(target_cached_input_tokens, 0));
  billable_input := greatest(0, coalesce(target_input_tokens, 0) - cached_tokens);
  output_tokens := greatest(0, coalesce(target_output_tokens, 0));
  reasoning_tokens := greatest(0, coalesce(target_reasoning_tokens, 0));

  if target_rate_card.output_includes_reasoning and reasoning_tokens > 0 then
    output_billable := greatest(0, output_tokens - reasoning_tokens);
  else
    output_billable := output_tokens;
  end if;

  provider_micro :=
    (billable_input::bigint * target_rate_card.input_micro_per_million) / 1000000
    + (cached_tokens::bigint * target_rate_card.cached_input_micro_per_million) / 1000000
    + (output_billable::bigint * target_rate_card.output_micro_per_million) / 1000000;

  return (
    provider_micro * target_rate_card.fx_reporting_micro_per_provider_micro
  ) / 1000000;
end;
$$;

create or replace function private.leanai_micro_to_cost_credits(target_reporting_micro bigint)
returns bigint
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when coalesce(target_reporting_micro, 0) <= 0 then 0::bigint
    else (
      coalesce(target_reporting_micro, 0) + private.leanai_micro_gbp_per_credit() - 1
    ) / private.leanai_micro_gbp_per_credit()
  end
$$;

create or replace function private.leanai_token_usage_to_cost_credits(
  target_rate_card private.leanai_provider_rate_cards,
  target_input_tokens integer,
  target_output_tokens integer,
  target_cached_input_tokens integer,
  target_reasoning_tokens integer
)
returns bigint
language sql
immutable
security definer
set search_path = ''
as $$
  select private.leanai_micro_to_cost_credits(
    private.leanai_reporting_micro_from_tokens(
      target_rate_card,
      target_input_tokens,
      target_output_tokens,
      target_cached_input_tokens,
      target_reasoning_tokens
    )
  )
$$;

create or replace function private.leanai_build_rate_snapshot(
  target_rate_card private.leanai_provider_rate_cards
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'card_version', target_rate_card.card_version,
    'provider', target_rate_card.provider,
    'model', target_rate_card.model,
    'reporting_currency', target_rate_card.reporting_currency,
    'provider_currency', target_rate_card.provider_currency,
    'fx_reporting_micro_per_provider_micro', target_rate_card.fx_reporting_micro_per_provider_micro,
    'input_micro_per_million', target_rate_card.input_micro_per_million,
    'output_micro_per_million', target_rate_card.output_micro_per_million,
    'cached_input_micro_per_million', target_rate_card.cached_input_micro_per_million,
    'reasoning_micro_per_million', target_rate_card.reasoning_micro_per_million,
    'output_includes_reasoning', target_rate_card.output_includes_reasoning,
    'reserve_max_input_tokens', target_rate_card.reserve_max_input_tokens,
    'reserve_max_output_tokens', target_rate_card.reserve_max_output_tokens,
    'reserve_max_tool_hops', target_rate_card.reserve_max_tool_hops,
    'reserve_tool_input_tokens_per_hop', target_rate_card.reserve_tool_input_tokens_per_hop,
    'provisional', target_rate_card.provisional,
    'rate_source', target_rate_card.rate_source,
    'rate_observed_at', target_rate_card.rate_observed_at,
    'micro_gbp_per_credit', private.leanai_micro_gbp_per_credit()
  )
$$;

create or replace function private.leanai_ai_run_reserve_upper_bound(
  target_organisation_id uuid,
  target_provider text,
  target_model text,
  target_user_message text
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rate_card private.leanai_provider_rate_cards;
  enforced boolean;
  est_input integer;
  est_output integer;
  tool_input integer;
begin
  enforced := private.leanai_credit_policy_enforced(target_organisation_id);
  rate_card := private.leanai_resolve_provider_rate_card(target_provider, target_model);

  if rate_card.id is null then
    if enforced then
      raise exception 'leanai provider rate card is unknown; cannot reserve cost credits'
        using errcode = '22023';
    end if;
    return 0;
  end if;

  est_input :=
    rate_card.reserve_max_input_tokens
    + rate_card.reserve_max_tool_hops * rate_card.reserve_tool_input_tokens_per_hop;
  est_output := rate_card.reserve_max_output_tokens;

  return private.leanai_token_usage_to_cost_credits(
    rate_card,
    est_input,
    est_output,
    0,
    0
  );
end;
$$;

create or replace function private.ai_credit_try_reserve(
  target_ai_run_id uuid,
  target_idempotency_key text,
  target_estimated_credits bigint default 1,
  target_rate_snapshot jsonb default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  period_id uuid;
  period_row public.organisation_ai_credit_periods%rowtype;
  existing uuid;
begin
  if org_id is null then
    return false;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    return true;
  end if;

  period_id := private.ensure_organisation_ai_credit_period(org_id);

  select reservation.id
  into existing
  from public.organisation_ai_credit_reservations reservation
  where reservation.organisation_id = org_id
    and reservation.idempotency_key = btrim(target_idempotency_key);

  if existing is not null then
    return true;
  end if;

  select period_table.*
  into period_row
  from public.organisation_ai_credit_periods period_table
  where period_table.id = period_id
  for update;

  if period_row.reserved_credits + period_row.consumed_credits + target_estimated_credits
    > period_row.allowance_credits then
    raise exception 'leanai credit allowance exceeded for this period'
      using errcode = '42501';
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = period_table.reserved_credits + target_estimated_credits
  where period_table.id = period_id;

  insert into public.organisation_ai_credit_reservations (
    organisation_id,
    ai_run_id,
    period_id,
    reserved_credits,
    idempotency_key,
    rate_snapshot
  )
  values (
    org_id,
    target_ai_run_id,
    period_id,
    target_estimated_credits,
    btrim(target_idempotency_key),
    target_rate_snapshot
  );

  update public.ai_runs run_table
  set credit_accounting_status = 'reserved'
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id;

  return true;
end;
$$;

create or replace function private.leanai_ai_run_try_reserve(
  target_organisation_id uuid,
  target_ai_run_id uuid,
  target_idempotency_key text,
  target_provider text,
  target_model text,
  target_user_message text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reserve_upper bigint;
  rate_card private.leanai_provider_rate_cards;
begin
  rate_card := private.leanai_resolve_provider_rate_card(target_provider, target_model);
  reserve_upper := private.leanai_ai_run_reserve_upper_bound(
    target_organisation_id,
    target_provider,
    target_model,
    target_user_message
  );
  if reserve_upper <= 0 then
    return true;
  end if;
  return private.ai_credit_try_reserve(
    target_ai_run_id,
    btrim(target_idempotency_key),
    reserve_upper,
    case
      when rate_card.id is null then null
      else private.leanai_build_rate_snapshot(rate_card)
    end
  );
end;
$$;

create or replace function private.ai_credit_settle(
  target_ai_run_id uuid,
  target_actual_credits bigint
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
  customer_charge bigint;
begin
  if org_id is null then
    return;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    update public.ai_runs run_table
    set credit_accounting_status = 'not_enforced'
    where run_table.organisation_id = org_id
      and run_table.id = target_ai_run_id;
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
  for update;

  if not found or reservation_row.status <> 'reserved' then
    return;
  end if;

  customer_charge := least(target_actual_credits, reservation_row.reserved_credits);

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = period_table.reserved_credits - reservation_row.reserved_credits,
      consumed_credits = period_table.consumed_credits + greatest(0, customer_charge)
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'settled',
      settled_credits = greatest(0, customer_charge),
      customer_settled_credits = greatest(0, customer_charge),
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;

  update public.ai_runs run_table
  set credit_accounting_status = 'settled'
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id;
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
  run_row public.ai_runs%rowtype;
  rate_card private.leanai_provider_rate_cards;
  actual_credits bigint;
  customer_credits bigint;
  reservation_row public.organisation_ai_credit_reservations%rowtype;
begin
  if org_id is null then
    return;
  end if;

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id;

  if not found then
    return;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    update public.ai_runs run_table
    set credit_accounting_status = 'not_enforced'
    where run_table.id = target_ai_run_id;
    return;
  end if;

  rate_card := private.leanai_resolve_provider_rate_card(run_row.provider, run_row.model);

  if rate_card.id is null then
    update public.organisation_ai_credit_reservations reservation_table
    set settle_cost_unknown = true
    where reservation_table.organisation_id = org_id
      and reservation_table.ai_run_id = target_ai_run_id;

    update public.ai_runs run_table
    set credit_accounting_status = 'unknown_rate'
    where run_table.id = target_ai_run_id;

    perform private.ai_credit_release(target_ai_run_id);
    return;
  end if;

  actual_credits := private.leanai_token_usage_to_cost_credits(
    rate_card,
    target_input_tokens,
    target_output_tokens,
    target_cached_input_tokens,
    target_reasoning_tokens
  );

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
  for update;

  if not found then
    update public.ai_runs run_table
    set credit_accounting_status = 'incomplete'
    where run_table.id = target_ai_run_id;
    return;
  end if;

  update public.organisation_ai_credit_reservations reservation_table
  set rate_card_version = rate_card.card_version,
      actual_provider_credits = actual_credits,
      overrun_credits = greatest(
        0,
        actual_credits - reservation_row.reserved_credits
      )
  where reservation_table.id = reservation_row.id;

  perform private.ai_credit_settle(target_ai_run_id, actual_credits);
end;
$$;

create or replace function private.reconcile_organisation_ai_credit_period_allowance(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounds record;
  period_row public.organisation_ai_credit_periods%rowtype;
  target_allowance bigint;
begin
  select *
  into bounds
  from private.organisation_ai_credit_period_bounds(target_organisation_id);

  target_allowance := private.organisation_ai_credit_allowance_for_period(target_organisation_id);

  select period_table.*
  into period_row
  from public.organisation_ai_credit_periods period_table
  where period_table.organisation_id = target_organisation_id
    and period_table.period_start = bounds.period_start
  for update;

  if not found then
  perform private.ensure_organisation_ai_credit_period(target_organisation_id);
    return;
  end if;

  if target_allowance > period_row.allowance_credits then
    update public.organisation_ai_credit_periods period_table
    set allowance_credits = target_allowance
    where period_table.id = period_row.id;
  end if;
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
begin
  for reservation_row in
    select reservation_table.*
    from public.organisation_ai_credit_reservations reservation_table
    join public.ai_runs run_table
      on run_table.organisation_id = reservation_table.organisation_id
     and run_table.id = reservation_table.ai_run_id
    where reservation_table.status = 'reserved'
      and (
        run_table.status in ('failed', 'cancelled')
        or (
          run_table.status = 'running'
          and run_table.started_at < statement_timestamp() - target_max_age
        )
      )
  loop
    perform private.ai_credit_release(reservation_row.ai_run_id);
    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

revoke all on function private.leanai_reporting_micro_from_tokens(
  private.leanai_provider_rate_cards, integer, integer, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function private.leanai_micro_to_cost_credits(bigint) from public, anon, authenticated, service_role;
revoke all on function private.leanai_build_rate_snapshot(private.leanai_provider_rate_cards)
  from public, anon, authenticated, service_role;
revoke all on function private.reconcile_organisation_ai_credit_period_allowance(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.sweep_stale_leanai_credit_reservations(interval)
  from public, anon, authenticated, service_role;

grant execute on function private.leanai_reporting_micro_from_tokens(
  private.leanai_provider_rate_cards, integer, integer, integer, integer
) to lean_hub_private_owner;
grant execute on function private.leanai_micro_to_cost_credits(bigint) to lean_hub_private_owner;
grant execute on function private.leanai_build_rate_snapshot(private.leanai_provider_rate_cards)
  to lean_hub_private_owner;
grant execute on function private.reconcile_organisation_ai_credit_period_allowance(uuid)
  to lean_hub_private_owner;
grant execute on function private.sweep_stale_leanai_credit_reservations(interval)
  to lean_hub_private_owner;

drop function if exists private.ai_credit_try_reserve(uuid, text, bigint);
revoke all on function private.ai_credit_try_reserve(uuid, text, bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.ai_credit_try_reserve(uuid, text, bigint, jsonb)
  to lean_hub_private_owner;
alter function private.ai_credit_try_reserve(uuid, text, bigint, jsonb)
  owner to lean_hub_private_owner;

create or replace function private.ai_credit_release(
  target_ai_run_id uuid
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
begin
  if org_id is null then
    return;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
    and reservation_table.status = 'reserved'
  for update;

  if not found then
    return;
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = greatest(
    0,
    period_table.reserved_credits - reservation_row.reserved_credits
  )
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'released',
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;

  update public.ai_runs run_table
  set credit_accounting_status = 'released'
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id;
end;
$$;
