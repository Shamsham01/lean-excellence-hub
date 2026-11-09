begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2c00000-0000-4000-8000-000000000001',
  'worker@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table worker_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on worker_ids to lean_hub_private_owner, authenticated;

insert into worker_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2c00000-0000-4000-8000-000000000001',
    'worker-org',
    'Worker Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from worker_ids where key = 'organisation'),
  'fake', 'cus_worker', 'sub_worker', 'essentials', 'monthly', 1,
  'price_fake', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 20:00:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id, ai_enabled, credit_policy_enforced
)
values (
  (select id from worker_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update set credit_policy_enforced = true;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2c01000-0000-4000-8000-000000000001',
  'b2c00000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2c00000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2c01000-0000-4000-8000-000000000001"}',
  true
);
select ok(
  public.switch_organisation((select id from worker_ids where key = 'organisation')),
  'org context for reservation'
);

reset role;

select ok(
  private.ai_credit_try_reserve(
    'b2c02000-0000-4000-8000-000000000001'::uuid,
    'worker-flip-1',
    50::bigint,
    null::jsonb
  ),
  'reserve while policy enforced'
);

update public.organisation_ai_settings
set credit_policy_enforced = false
where organisation_id = (select id from worker_ids where key = 'organisation');

set local role lean_hub_private_owner;

select ok(
  private.ai_credit_release_for_organisation(
    (select id from worker_ids where key = 'organisation'),
    'b2c02000-0000-4000-8000-000000000001'::uuid
  ),
  'org-scoped release succeeds without session org context'
);

select is(
  (
    select status
    from public.organisation_ai_credit_reservations
    where ai_run_id = 'b2c02000-0000-4000-8000-000000000001'::uuid
  ),
  'released',
  'release row marked released after policy flip off'
);

set local role postgres;

select is(
  private.invoke_leanai_credit_reservation_sweeper(),
  0,
  'sweeper service role runs without authenticated session'
);

select public.apply_organisation_subscription_snapshot(
  (select id from worker_ids where key = 'organisation'),
  'fake', 'cus_worker', 'sub_worker', 'professional', 'monthly', 2,
  'price_fake', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 20:05:00+00'
);

set local role lean_hub_private_owner;

select is(
  (
    select allowance_credits
    from public.organisation_ai_credit_periods
    where organisation_id = (select id from worker_ids where key = 'organisation')
    order by period_start desc
    limit 1
  ),
  240000::bigint,
  'plan upgrade + extra site reconciles allowance (120k * 2 sites)'
);

update public.organisation_ai_settings
set credit_policy_enforced = true
where organisation_id = (select id from worker_ids where key = 'organisation');

select throws_ok(
  $$
    select private.leanai_ai_run_reserve_upper_bound(
      (select id from worker_ids where key = 'organisation'),
      'openai',
      'gpt-4.1-mini',
      'hello'
    );
  $$,
  '22023',
  'leanai provider rate card is unknown or not enforceable; cannot reserve cost credits',
  'illustration openai mini is not enforceable when policy on'
);

select cmp_ok(
  private.leanai_ai_run_reserve_upper_bound(
    (select id from worker_ids where key = 'organisation'),
    'fake',
    'fake-model',
    'x'
  ),
  '>',
  (
    select private.leanai_token_usage_to_cost_credits(
      card_table,
      card_table.reserve_max_input_tokens,
      card_table.reserve_max_output_tokens,
      0,
      0
    )
    from private.leanai_provider_rate_cards card_table
    where card_table.provider = 'fake'
      and card_table.model = 'fake-model'
      and card_table.enforceable_for_billing = true
    limit 1
  ),
  'reserve upper bound includes configured tool-hop fees'
);

set local role postgres;

select ok(
  exists (
    select 1
    from cron.job job
    where job.jobname = 'leh_leanai_credit_reservation_sweep_every_fifteen_minutes'
      and job.active
  ),
  'credit reservation sweeper cron is registered'
);

select finish();
rollback;
