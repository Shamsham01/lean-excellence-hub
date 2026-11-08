-- BILLING-08: Cost-based LeanAI credits (provisional rate cards). Enforcement remains
-- opt-in via organisation_ai_settings.credit_policy_enforced (default false).
-- 1 credit = 1 micro-unit of organisation reporting currency at provider cost
-- (NOT 1 token). Allowance pools are monthly cost-credit budgets per billed site.

create table if not exists private.leanai_provider_rate_cards (
  id uuid primary key default gen_random_uuid(),
  card_version text not null,
  provider text not null,
  model text not null,
  reporting_currency text not null default 'GBP',
  -- micro-units of reporting currency per 1_000_000 billable tokens
  input_micro_per_million bigint not null,
  output_micro_per_million bigint not null,
  cached_input_micro_per_million bigint not null,
  reasoning_micro_per_million bigint not null default 0,
  reserve_max_input_tokens integer not null default 8192,
  reserve_max_output_tokens integer not null default 4096,
  provisional boolean not null default true,
  effective_at timestamptz not null default statement_timestamp(),
  unique (provider, model, card_version)
);

alter table public.organisation_ai_credit_reservations
  add column if not exists rate_card_version text,
  add column if not exists settle_cost_unknown boolean not null default false,
  add column if not exists overrun_credits bigint not null default 0;

revoke all on table private.leanai_provider_rate_cards
  from public, anon, authenticated, service_role;
grant select on table private.leanai_provider_rate_cards to lean_hub_private_owner;

insert into private.leanai_provider_rate_cards (
  card_version,
  provider,
  model,
  input_micro_per_million,
  output_micro_per_million,
  cached_input_micro_per_million,
  reasoning_micro_per_million,
  reserve_max_input_tokens,
  reserve_max_output_tokens,
  provisional
)
values
  (
    'provisional-2026-11',
    'fake',
    'fake-model',
    500_000,
    1_500_000,
    100_000,
    0,
    4096,
    2048,
    true
  ),
  (
    'provisional-2026-11',
    'openai',
    'gpt-4.1-mini',
    400_000,
    1_600_000,
    100_000,
    0,
    8192,
    4096,
    true
  )
on conflict (provider, model, card_version) do nothing;

create or replace function private.leanai_resolve_provider_rate_card(
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
  order by card_table.effective_at desc
  limit 1
$$;

revoke all on function private.leanai_resolve_provider_rate_card(text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.leanai_resolve_provider_rate_card(text, text)
  to lean_hub_private_owner;

create or replace function private.leanai_token_usage_to_cost_credits(
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
  billable_input integer;
  cached_tokens integer;
  output_tokens integer;
  reasoning_tokens integer;
begin
  cached_tokens := greatest(0, coalesce(target_cached_input_tokens, 0));
  billable_input := greatest(0, coalesce(target_input_tokens, 0) - cached_tokens);
  output_tokens := greatest(0, coalesce(target_output_tokens, 0));
  reasoning_tokens := greatest(0, coalesce(target_reasoning_tokens, 0));

  return (
    (billable_input::bigint * target_rate_card.input_micro_per_million) / 1000000
    + (cached_tokens::bigint * target_rate_card.cached_input_micro_per_million) / 1000000
    + (output_tokens::bigint * target_rate_card.output_micro_per_million) / 1000000
    + (reasoning_tokens::bigint * target_rate_card.reasoning_micro_per_million) / 1000000
  );
end;
$$;

revoke all on function private.leanai_token_usage_to_cost_credits(
  private.leanai_provider_rate_cards,
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated, service_role;
grant execute on function private.leanai_token_usage_to_cost_credits(
  private.leanai_provider_rate_cards,
  integer,
  integer,
  integer,
  integer
) to lean_hub_private_owner;

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
  max_output integer;
begin
  enforced := private.leanai_credit_policy_enforced(target_organisation_id);
  rate_card := private.leanai_resolve_provider_rate_card(
    target_provider,
    target_model
  );

  if rate_card.id is null then
    if enforced then
      raise exception 'leanai provider rate card is unknown; cannot reserve cost credits'
        using errcode = '22023';
    end if;
    return 0;
  end if;

  est_input := least(
    rate_card.reserve_max_input_tokens,
    greatest(64, char_length(coalesce(target_user_message, '')) / 4)
  );
  max_output := rate_card.reserve_max_output_tokens;

  return private.leanai_token_usage_to_cost_credits(
    rate_card,
    est_input,
    max_output,
    0,
    0
  );
end;
$$;

revoke all on function private.leanai_ai_run_reserve_upper_bound(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.leanai_ai_run_reserve_upper_bound(uuid, text, text, text)
  to lean_hub_private_owner;

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

  rate_card := private.leanai_resolve_provider_rate_card(
    run_row.provider,
    run_row.model
  );

  if rate_card.id is null then
    update public.organisation_ai_credit_reservations reservation_table
    set settle_cost_unknown = true
    where reservation_table.organisation_id = org_id
      and reservation_table.ai_run_id = target_ai_run_id;

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
    if private.leanai_credit_policy_enforced(org_id) then
      raise exception 'leanai credit reservation missing for run'
        using errcode = '55000';
    end if;
    return;
  end if;

  update public.organisation_ai_credit_reservations reservation_table
  set rate_card_version = rate_card.card_version,
      overrun_credits = greatest(
        0,
        actual_credits - reservation_table.reserved_credits
      )
  where reservation_table.id = reservation_row.id;

  perform private.ai_credit_settle(target_ai_run_id, actual_credits);
end;
$$;

revoke all on function private.ai_credit_settle_from_run_usage(uuid, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.ai_credit_settle_from_run_usage(uuid, integer, integer, integer, integer)
  to lean_hub_private_owner;

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
begin
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
    reserve_upper
  );
end;
$$;

revoke all on function private.leanai_ai_run_try_reserve(uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.leanai_ai_run_try_reserve(uuid, uuid, text, text, text, text)
  to lean_hub_private_owner;
