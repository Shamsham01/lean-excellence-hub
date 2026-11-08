begin;

select plan(22);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'e3160000-0000-4000-8000-0000000000aa',
  'leanai-cost-operator@leh.example',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into private.platform_admins (auth_user_id, label, bootstrap_note)
values (
  'e3160000-0000-4000-8000-0000000000aa',
  'Cost governance fixture',
  'pgTAP'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.platform_admin_leanai_cost_governance(uuid, text, text, uuid, timestamptz, timestamptz)',
    'execute'
  ),
  false,
  'authenticated cannot execute leanai cost governance RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.platform_admin_leanai_cost_governance(uuid, text, text, uuid, timestamptz, timestamptz)',
    'execute'
  ),
  false,
  'anon cannot execute leanai cost governance RPC'
);

select throws_ok(
  $$select public.platform_admin_leanai_cost_governance(
    'e3160000-0000-4000-8000-0000000000aa',
    'aal1',
    '/org_admin/leanai-cost'
  )$$,
  '42501',
  'platform admin access is not authorised',
  'platform admin without aal2 cannot read cost governance'
);

select is(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      2500000,
      0,
      400000,
      0,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'pricing_status'
  ),
  'complete',
  'known Luna model is priced'
);

select ok(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      2500000,
      0,
      400000,
      0,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'estimated_usd'
  )::numeric between 0.44 and 0.46,
  'standard token estimate is non-zero and in expected band'
);

select is(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-unknown',
      1000,
      0,
      100,
      0,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'pricing_status'
  ),
  'unpriced',
  'unknown model is unpriced not zero'
);

select is(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      100,
      200,
      10,
      0,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'pricing_status'
  ),
  'incomplete',
  'cached greater than input is incomplete'
);

select is(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      10000,
      2000,
      500,
      300,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'pricing_status'
  ),
  'complete',
  'cached subset pricing succeeds'
);

select ok(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      10000,
      2000,
      500,
      300,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'estimated_usd'
  )::numeric
  >
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      10000,
      0,
      500,
      300,
      0,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'estimated_usd'
  )::numeric,
  'cached tokens reduce billable input cost versus uncached-only baseline'
);

select is(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      0,
      0,
      0,
      0,
      5,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'pricing_status'
  ),
  'complete',
  'web search calls price when rate exists'
);

select ok(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      0,
      0,
      0,
      0,
      5,
      timestamptz '2026-11-01 00:00:00+00'
    ) ->> 'tool_cost_usd'
  )::numeric = 0.05,
  'web search tool cost matches illustration ($10/1000)'
);

select is(
  private.ai_rate_card_version_for_timestamp(
    timestamptz '2026-11-01 00:00:00+00'
  ),
  'openai-illustration-2026-10-26',
  'rate card resolves by effective date'
);

insert into private.ai_provider_rate_card_versions (
  id,
  effective_from,
  source_label
)
values (
  'openai-test-2026-12-01',
  timestamptz '2026-12-01 00:00:00+00',
  'pgTAP price-change fixture'
);

insert into private.ai_provider_model_rates (
  rate_card_version_id,
  provider,
  model,
  input_usd_per_million,
  cached_input_usd_per_million,
  output_usd_per_million
)
values (
  'openai-test-2026-12-01',
  'openai',
  'gpt-6-luna',
  0.20,
  0.02,
  1.00
);

select ok(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      1000000,
      0,
      0,
      0,
      0,
      timestamptz '2026-12-02 00:00:00+00'
    ) ->> 'estimated_usd'
  )::numeric = 0.20,
  'later rate card version applies from its effective date'
);

select ok(
  (
    private.estimate_ai_provider_usage_cost_usd(
      'openai',
      'gpt-6-luna',
      1000000,
      0,
      0,
      0,
      0,
      timestamptz '2026-11-15 00:00:00+00'
    ) ->> 'estimated_usd'
  )::numeric = 0.10,
  'usage before a new rate card keeps the prior version'
);

select is(
  (
    select private.platform_admin_leanai_cost_governance(
      'e3160000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/leanai-cost'
    ) -> 'totals' ->> 'usage_event_count'
  ),
  '0',
  'empty report returns safe totals without cross-tenant prompts'
);

select ok(
  exists (
    select 1
    from private.platform_admin_access_events event_row
    where event_row.action = 'leanai_cost.read'
      and event_row.outcome = 'allowed'
  ),
  'successful cost report writes an audited leanai_cost.read event'
);

select ok(
  not exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'get_ai_usage_summary'
      and has_function_privilege('anon', proc.oid, 'execute')
  ),
  'customer usage summary remains unavailable to anon'
);

select throws_ok(
  $$select public.get_ai_usage_summary()$$,
  '42501',
  null,
  'get_ai_usage_summary still requires ai.manage_settings session context'
);

select * from finish();

rollback;
