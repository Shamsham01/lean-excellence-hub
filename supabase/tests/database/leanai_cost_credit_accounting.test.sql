begin;

select plan(6);

select is(
  private.leanai_micro_gbp_per_credit(),
  1000::bigint,
  '1 cost credit = 1000 micro-GBP (£0.001)'
);

select is(
  private.leanai_micro_to_cost_credits(2500),
  3::bigint,
  'credits round up reporting micro-units'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2a10000-0000-4000-8000-000000000099',
  'cc-unit@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table cc_unit_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on cc_unit_ids to lean_hub_private_owner, authenticated;

insert into cc_unit_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2a10000-0000-4000-8000-000000000099',
    'cc-unit-org',
    'CC Unit Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from cc_unit_ids where key = 'organisation'),
  'fake', 'cus_ccu', 'sub_ccu', 'essentials', 'monthly', 1,
  'price_fake', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 18:00:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id, ai_enabled, credit_policy_enforced
)
values (
  (select id from cc_unit_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update set credit_policy_enforced = true;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2a11000-0000-4000-8000-000000000099',
  'b2a10000-0000-4000-8000-000000000099',
  statement_timestamp(),
  statement_timestamp()
);

set local role lean_hub_private_owner;

select is(
  private.organisation_ai_credit_allowance_for_period(
    (select id from cc_unit_ids where key = 'organisation')
  ),
  30000::bigint,
  'essentials allowance is 30k cost credits (£30 illustrative)'
);

select ok(
  private.leanai_token_usage_to_cost_credits(
    private.leanai_resolve_provider_rate_card('fake', 'fake-model'),
    0,
    10_000,
    0,
    10_000
  )
  < private.leanai_token_usage_to_cost_credits(
    private.leanai_resolve_provider_rate_card('fake', 'fake-model'),
    0,
    10_000,
    0,
    0
  ),
  'reasoning tokens inside output are not double-charged'
);

select ok(
  (
    select not rate_card.enforceable_for_billing
    from private.leanai_resolve_provider_rate_card('openai', 'gpt-4.1-mini') rate_card
  ),
  'openai mini illustration card is never enforceable by default'
);

select ok(
  not exists (
    select 1
    from private.leanai_provider_rate_cards card_table
    where card_table.provider = 'openai'
      and card_table.model = 'gpt-4.1-mini'
      and card_table.enforceable_for_billing = true
  ),
  'enforceable resolver does not return illustration-only openai mini'
);

select finish();
rollback;
