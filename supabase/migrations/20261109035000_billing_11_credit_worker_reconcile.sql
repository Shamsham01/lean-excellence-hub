-- BILLING-11: privileged org-scoped release + sweeper cron; reconcile allowances on
-- subscription/site changes; enforceable-only rate cards (no silent mini fallback).

alter table private.leanai_provider_rate_cards
  add column if not exists enforceable_for_billing boolean not null default false,
  add column if not exists reserve_tool_fee_credits_per_hop bigint not null default 0;

alter table private.leanai_provider_rate_cards
  alter column fx_reporting_micro_per_provider_micro drop not null;

comment on column private.leanai_provider_rate_cards.enforceable_for_billing is
  'When false, card is illustration-only and must not drive enforced reserve/settle.';

update private.leanai_provider_rate_cards
set
  enforceable_for_billing = true,
  provider_currency = 'GBP',
  fx_reporting_micro_per_provider_micro = 1000000,
  rate_source = 'ci-fake-enforceable',
  reserve_tool_fee_credits_per_hop = 1
where provider = 'fake' and model = 'fake-model';

update private.leanai_provider_rate_cards
set
  enforceable_for_billing = false,
  provider_currency = 'USD',
  fx_reporting_micro_per_provider_micro = null,
  rate_source = 'illustration-unverified-not-enforceable',
  provisional = true
where provider = 'openai' and model = 'gpt-4.1-mini';

create or replace function private.leanai_resolve_enforceable_provider_rate_card(
  target_provider text,
  target_model text
)
returns private.leanai_provider_rate_cards
language sql
stable
security definer
set search_path = ''
as $$
  select card_table.*
  from private.leanai_provider_rate_cards card_table
  where card_table.provider = btrim(target_provider)
    and card_table.model = btrim(target_model)
    and card_table.enforceable_for_billing = true
    and card_table.input_micro_per_million is not null
    and card_table.output_micro_per_million is not null
    and (
      card_table.provider_currency = card_table.reporting_currency
      or card_table.fx_reporting_micro_per_provider_micro is not null
    )
  order by card_table.effective_at desc
  limit 1
$$;

revoke all on function private.leanai_resolve_enforceable_provider_rate_card(text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.leanai_resolve_enforceable_provider_rate_card(text, text)
  to lean_hub_private_owner;

create or replace function private.ai_credit_release_for_organisation(
  target_organisation_id uuid,
  target_ai_run_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reservation_row public.organisation_ai_credit_reservations%rowtype;
begin
  if target_organisation_id is null or target_ai_run_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.ai_runs run_table
    where run_table.id = target_ai_run_id
      and run_table.organisation_id is distinct from target_organisation_id
  ) then
    return false;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = target_organisation_id
    and reservation_table.ai_run_id = target_ai_run_id
    and reservation_table.status = 'reserved'
  for update;

  if not found then
    return false;
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
  where run_table.organisation_id = target_organisation_id
    and run_table.id = target_ai_run_id;

  return true;
end;
$$;

create or replace function private.ai_credit_release(target_ai_run_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    return;
  end if;

  perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
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
  floor_allowance bigint;
begin
  if target_organisation_id is null then
    return;
  end if;

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

  floor_allowance := period_row.consumed_credits + period_row.reserved_credits;

  if target_allowance < period_row.allowance_credits then
    if target_allowance >= floor_allowance then
      update public.organisation_ai_credit_periods period_table
      set allowance_credits = target_allowance
      where period_table.id = period_row.id;
    end if;
    return;
  end if;

  if target_allowance > period_row.allowance_credits then
    update public.organisation_ai_credit_periods period_table
    set allowance_credits = target_allowance
    where period_table.id = period_row.id;
  end if;
end;
$$;

create or replace function private.trg_reconcile_ai_credit_on_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.reconcile_organisation_ai_credit_period_allowance(new.organisation_id);
  return new;
end;
$$;

drop trigger if exists reconcile_ai_credit_after_subscription_change
  on public.organisation_subscriptions;

create trigger reconcile_ai_credit_after_subscription_change
after insert or update of plan_code, site_quantity
on public.organisation_subscriptions
for each row
execute function private.trg_reconcile_ai_credit_on_subscription_change();

create or replace function private.ensure_organisation_ai_credit_period(
  target_organisation_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounds record;
  period_id uuid;
  allowance bigint;
begin
  select *
  into bounds
  from private.organisation_ai_credit_period_bounds(target_organisation_id);

  select period_table.id
  into period_id
  from public.organisation_ai_credit_periods period_table
  where period_table.organisation_id = target_organisation_id
    and period_table.period_start = bounds.period_start;

  if period_id is not null then
    perform private.reconcile_organisation_ai_credit_period_allowance(target_organisation_id);
    return period_id;
  end if;

  allowance := private.organisation_ai_credit_allowance_for_period(
    target_organisation_id
  );

  insert into public.organisation_ai_credit_periods (
    organisation_id,
    period_start,
    period_end,
    allowance_credits
  )
  values (
    target_organisation_id,
    bounds.period_start,
    bounds.period_end,
    allowance
  )
  returning id into period_id;

  return period_id;
end;
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
  tool_credits bigint;
begin
  enforced := private.leanai_credit_policy_enforced(target_organisation_id);
  if not enforced then
    return 0;
  end if;

  rate_card := private.leanai_resolve_enforceable_provider_rate_card(
    target_provider,
    target_model
  );

  if rate_card.id is null then
    raise exception 'leanai provider rate card is unknown or not enforceable; cannot reserve cost credits'
      using errcode = '22023';
  end if;

  est_input :=
    rate_card.reserve_max_input_tokens
    + rate_card.reserve_max_tool_hops * rate_card.reserve_tool_input_tokens_per_hop;
  est_output := rate_card.reserve_max_output_tokens;
  tool_credits :=
    rate_card.reserve_max_tool_hops::bigint * rate_card.reserve_tool_fee_credits_per_hop;

  return private.leanai_token_usage_to_cost_credits(
    rate_card,
    est_input,
    est_output,
    0,
    0
  ) + coalesce(tool_credits, 0);
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
  rate_card := private.leanai_resolve_enforceable_provider_rate_card(
    target_provider,
    target_model
  );
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
    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
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
    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
    update public.ai_runs run_table
    set credit_accounting_status = 'not_enforced'
    where run_table.id = target_ai_run_id;
    return;
  end if;

  rate_card := private.leanai_resolve_enforceable_provider_rate_card(
    run_row.provider,
    run_row.model
  );

  if rate_card.id is null then
    update public.organisation_ai_credit_reservations reservation_table
    set settle_cost_unknown = true
    where reservation_table.organisation_id = org_id
      and reservation_table.ai_run_id = target_ai_run_id;

    update public.ai_runs run_table
    set credit_accounting_status = 'unknown_rate'
    where run_table.id = target_ai_run_id;

    perform private.ai_credit_release_for_organisation(org_id, target_ai_run_id);
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
        run_table.status in ('failed', 'cancelled')
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

create or replace function private.invoke_leanai_credit_reservation_sweeper()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.sweep_stale_leanai_credit_reservations(interval '4 hours');
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'leh_leanai_credit_reservation_sweep_every_fifteen_minutes';

select cron.schedule(
  'leh_leanai_credit_reservation_sweep_every_fifteen_minutes',
  '*/15 * * * *',
  $$select private.invoke_leanai_credit_reservation_sweeper();$$
);

revoke all on function private.ai_credit_release_for_organisation(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.invoke_leanai_credit_reservation_sweeper()
  from public, anon, authenticated, service_role;

grant execute on function private.ai_credit_release_for_organisation(uuid, uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.sweep_stale_leanai_credit_reservations(interval)
  to lean_hub_private_owner, postgres;
grant execute on function private.invoke_leanai_credit_reservation_sweeper()
  to postgres, lean_hub_private_owner;

alter function private.invoke_leanai_credit_reservation_sweeper() owner to postgres;
