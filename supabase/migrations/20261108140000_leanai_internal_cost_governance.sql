-- Issue #316 slice 2: internal LeanAI cost governance (platform operators only).
-- Do not apply to hosted Supabase from agent runs.

-- ---------------------------------------------------------------------------
-- Versioned internal rate card (USD planning estimates — not customer pricing)
-- ---------------------------------------------------------------------------

create table private.ai_provider_rate_card_versions (
  id text primary key,
  effective_from timestamptz not null,
  source_label text not null,
  source_url text,
  currency text not null default 'USD',
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_provider_rate_card_versions_id_check
    check (
      id = btrim(id)
      and char_length(id) between 1 and 80
    ),
  constraint ai_provider_rate_card_versions_source_check
    check (
      source_label = btrim(source_label)
      and char_length(source_label) between 1 and 200
    ),
  constraint ai_provider_rate_card_versions_currency_check
    check (currency = 'USD')
);

comment on table private.ai_provider_rate_card_versions is
  'Append-only style version headers for internal provider cost estimates. Add new rows; do not rewrite history.';

create table private.ai_provider_model_rates (
  rate_card_version_id text not null
    references private.ai_provider_rate_card_versions (id) on delete restrict,
  provider text not null,
  model text not null,
  input_usd_per_million numeric(18, 8) not null,
  cached_input_usd_per_million numeric(18, 8) not null,
  output_usd_per_million numeric(18, 8) not null,
  primary key (rate_card_version_id, provider, model),
  constraint ai_provider_model_rates_provider_check
    check (provider = btrim(provider) and char_length(provider) between 1 and 64),
  constraint ai_provider_model_rates_model_check
    check (model = btrim(model) and char_length(model) between 1 and 128),
  constraint ai_provider_model_rates_non_negative_check
  check (
    input_usd_per_million >= 0
    and cached_input_usd_per_million >= 0
    and output_usd_per_million >= 0
  )
);

create table private.ai_provider_tool_rates (
  rate_card_version_id text not null
    references private.ai_provider_rate_card_versions (id) on delete restrict,
  provider text not null,
  tool_name text not null,
  usd_per_thousand_calls numeric(18, 8) not null,
  primary key (rate_card_version_id, provider, tool_name),
  constraint ai_provider_tool_rates_non_negative_check
    check (usd_per_thousand_calls >= 0)
);

create table private.platform_billing_catalogue_reference (
  plan_code text not null,
  billing_interval text not null,
  site_price_minor_gbp integer not null,
  effective_from timestamptz not null,
  source_label text not null,
  primary key (plan_code, billing_interval, effective_from),
  constraint platform_billing_catalogue_reference_plan_check
    check (plan_code in ('essentials', 'professional', 'enterprise', 'founder')),
  constraint platform_billing_catalogue_reference_interval_check
    check (billing_interval in ('monthly', 'annual')),
  constraint platform_billing_catalogue_reference_price_check
    check (site_price_minor_gbp >= 0)
);

comment on table private.platform_billing_catalogue_reference is
  'Catalogue-listed GBP site prices for internal subscription revenue benchmarks. Mirrors src/modules/billing/catalogue.ts.';

create table private.platform_fx_reference_rates (
  id text primary key,
  quote_currency text not null,
  base_currency text not null default 'USD',
  rate numeric(18, 10) not null,
  effective_from timestamptz not null,
  source_label text not null,
  constraint platform_fx_reference_rates_quote_check
    check (quote_currency = 'GBP' and base_currency = 'USD'),
  constraint platform_fx_reference_rates_positive_check
    check (rate > 0)
);

comment on table private.platform_fx_reference_rates is
  'Planning FX rates for cross-currency internal benchmarks only — not billing.';

revoke all on private.ai_provider_rate_card_versions from public, anon, authenticated;
revoke all on private.ai_provider_model_rates from public, anon, authenticated;
revoke all on private.ai_provider_tool_rates from public, anon, authenticated;
revoke all on private.platform_billing_catalogue_reference from public, anon, authenticated;
revoke all on private.platform_fx_reference_rates from public, anon, authenticated;

grant select on private.ai_provider_rate_card_versions to lean_hub_private_owner;
grant select on private.ai_provider_model_rates to lean_hub_private_owner;
grant select on private.ai_provider_tool_rates to lean_hub_private_owner;
grant select on private.platform_billing_catalogue_reference to lean_hub_private_owner;
grant select on private.platform_fx_reference_rates to lean_hub_private_owner;

insert into private.ai_provider_rate_card_versions (
  id,
  effective_from,
  source_label,
  source_url
)
values (
  'openai-illustration-2026-10-26',
  timestamptz '2026-10-26 00:00:00+00',
  'Illustrative list prices from docs/operations/LEANAI-MODEL-MIGRATION.md (26 Oct 2026). Planning estimate only.',
  'docs/operations/LEANAI-MODEL-MIGRATION.md'
);

insert into private.ai_provider_model_rates (
  rate_card_version_id,
  provider,
  model,
  input_usd_per_million,
  cached_input_usd_per_million,
  output_usd_per_million
)
values
  (
    'openai-illustration-2026-10-26',
    'openai',
    'gpt-6-luna',
    0.10,
    0.01,
    0.50
  ),
  (
    'openai-illustration-2026-10-26',
    'openai',
    'gpt-6.1-terra',
    1.00,
    0.05,
    5.00
  ),
  (
    'openai-illustration-2026-10-26',
    'openai',
    'gpt-6.1-sol',
    2.00,
    0.10,
    10.00
  );

insert into private.ai_provider_tool_rates (
  rate_card_version_id,
  provider,
  tool_name,
  usd_per_thousand_calls
)
values
  (
    'openai-illustration-2026-10-26',
    'openai',
    'web_search',
    10.0
  ),
  (
    'openai-illustration-2026-10-26',
    'openai',
    'web_search_2025_08_26',
    10.0
  );

insert into private.platform_billing_catalogue_reference (
  plan_code,
  billing_interval,
  site_price_minor_gbp,
  effective_from,
  source_label
)
values
  (
    'essentials',
    'monthly',
    49900,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue (pricing-subscription-onboarding-v1)'
  ),
  (
    'essentials',
    'annual',
    538920,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue annual (10% discount on 12× monthly)'
  ),
  (
    'professional',
    'monthly',
    99900,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue (pricing-subscription-onboarding-v1)'
  ),
  (
    'professional',
    'annual',
    1078920,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue annual (10% discount on 12× monthly)'
  ),
  (
    'founder',
    'monthly',
    49900,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue (pricing-subscription-onboarding-v1)'
  ),
  (
    'founder',
    'annual',
    538920,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue annual (10% discount on 12× monthly)'
  ),
  (
    'enterprise',
    'monthly',
    150000,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue list reference (contact sales)'
  ),
  (
    'enterprise',
    'annual',
    1620000,
    timestamptz '2026-01-01 00:00:00+00',
    'LEH plan catalogue annual reference (10% on monthly list)'
  );

insert into private.platform_fx_reference_rates (
  id,
  rate,
  effective_from,
  source_label
)
values (
  'usd-gbp-planning-2026-11-01',
  0.79,
  timestamptz '2026-11-01 00:00:00+00',
  'Internal planning benchmark — USD/GBP spot reference for operator review only (not billing).'
);

-- ---------------------------------------------------------------------------
-- Estimation helpers
-- ---------------------------------------------------------------------------

create or replace function private.ai_rate_card_version_for_timestamp(
  target_occurred_at timestamptz
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select version_row.id
  from private.ai_provider_rate_card_versions version_row
  where version_row.effective_from <= target_occurred_at
  order by version_row.effective_from desc
  limit 1
$$;

create or replace function private.estimate_ai_provider_usage_cost_usd(
  target_provider text,
  target_model text,
  target_input_tokens integer,
  target_cached_input_tokens integer,
  target_output_tokens integer,
  target_reasoning_tokens integer,
  target_web_search_calls integer,
  target_occurred_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  version_id text;
  model_rate_row private.ai_provider_model_rates%rowtype;
  web_rate numeric(18, 8);
  billable_cached integer;
  billable_input integer;
  token_cost numeric(18, 8);
  tool_cost numeric(18, 8);
  issues jsonb := '[]'::jsonb;
  pricing_status text := 'complete';
begin
  if coalesce(target_input_tokens, 0) < 0
    or coalesce(target_cached_input_tokens, 0) < 0
    or coalesce(target_output_tokens, 0) < 0
    or coalesce(target_reasoning_tokens, 0) < 0 then
    return jsonb_build_object(
      'pricing_status', 'incomplete',
      'estimated_usd', null,
      'issues', jsonb_build_array('negative_token_count')
    );
  end if;

  version_id := private.ai_rate_card_version_for_timestamp(target_occurred_at);
  if version_id is null then
    return jsonb_build_object(
      'pricing_status', 'unpriced',
      'estimated_usd', null,
      'issues', jsonb_build_array('missing_rate_card')
    );
  end if;

  select rate_row.*
  into model_rate_row
  from private.ai_provider_model_rates rate_row
  where rate_row.rate_card_version_id = version_id
    and rate_row.provider = target_provider
    and rate_row.model = target_model;

  if not found then
    return jsonb_build_object(
      'pricing_status', 'unpriced',
      'estimated_usd', null,
      'rate_card_version_id', version_id,
      'issues', jsonb_build_array('unknown_model')
    );
  end if;

  if target_cached_input_tokens > target_input_tokens then
    issues := issues || jsonb_build_array('cached_exceeds_input');
    pricing_status := 'incomplete';
  end if;
  if target_reasoning_tokens > target_output_tokens then
    issues := issues || jsonb_build_array('reasoning_exceeds_output');
    pricing_status := 'incomplete';
  end if;

  billable_cached := least(target_cached_input_tokens, target_input_tokens);
  billable_input := greatest(0, target_input_tokens - billable_cached);

  token_cost :=
    (billable_input::numeric * model_rate_row.input_usd_per_million / 1000000.0)
    + (
      billable_cached::numeric
      * model_rate_row.cached_input_usd_per_million
      / 1000000.0
    )
    + (
      target_output_tokens::numeric
      * model_rate_row.output_usd_per_million
      / 1000000.0
    );

  tool_cost := 0;
  if coalesce(target_web_search_calls, 0) > 0 then
    select rate_row.usd_per_thousand_calls
    into web_rate
    from private.ai_provider_tool_rates rate_row
    where rate_row.rate_card_version_id = version_id
      and rate_row.provider = target_provider
      and rate_row.tool_name = 'web_search'
    limit 1;

    if web_rate is null then
      issues := issues || jsonb_build_array('missing_web_search_rate');
      pricing_status := 'incomplete';
    else
      tool_cost := target_web_search_calls::numeric * web_rate / 1000.0;
    end if;
  end if;

  if pricing_status = 'incomplete' then
    return jsonb_build_object(
      'pricing_status', 'incomplete',
      'estimated_usd', null,
      'rate_card_version_id', version_id,
      'token_cost_usd', null,
      'tool_cost_usd', null,
      'billable_input_tokens', billable_input,
      'billable_cached_input_tokens', billable_cached,
      'billable_output_tokens', target_output_tokens,
      'issues', issues
    );
  end if;

  return jsonb_build_object(
    'pricing_status', 'complete',
    'estimated_usd', token_cost + tool_cost,
    'rate_card_version_id', version_id,
    'token_cost_usd', token_cost,
    'tool_cost_usd', tool_cost,
    'billable_input_tokens', billable_input,
    'billable_cached_input_tokens', billable_cached,
    'billable_output_tokens', target_output_tokens,
    'issues', issues
  );
end;
$$;

create or replace function private.platform_catalogue_monthly_revenue_gbp(
  target_plan_code text,
  target_billing_interval text,
  target_site_quantity integer,
  target_at timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with price_row as (
    select reference_row.site_price_minor_gbp
    from private.platform_billing_catalogue_reference reference_row
    where reference_row.plan_code = target_plan_code
      and reference_row.billing_interval = target_billing_interval
      and reference_row.effective_from <= target_at
    order by reference_row.effective_from desc
    limit 1
  )
  select case
    when target_plan_code is null
      or target_billing_interval is null
      or coalesce(target_site_quantity, 0) <= 0 then
      null
    when not exists (select 1 from price_row) then
      null
    when target_billing_interval = 'monthly' then
      (select price_row.site_price_minor_gbp from price_row)
        * target_site_quantity
        / 100.0
    else
      (select price_row.site_price_minor_gbp from price_row)
        * target_site_quantity
        / 12.0
        / 100.0
  end
$$;

-- Extend platform-admin audit actions.
alter table private.platform_admin_access_events
  drop constraint platform_admin_access_events_action_check;

alter table private.platform_admin_access_events
  add constraint platform_admin_access_events_action_check
  check (
    action in (
      'console.read',
      'directory.read',
      'organisation.read',
      'notifications.read',
      'login.attempt',
      'leanai_cost.read'
    )
  );

create or replace function private.record_platform_admin_access(
  actor_user_id uuid,
  event_outcome text,
  event_action text,
  request_path text,
  resource_id uuid,
  event_detail jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  stored_detail jsonb := coalesce(event_detail, '{}'::jsonb);
begin
  if event_outcome not in ('allowed', 'denied', 'mfa_required', 'rate_limited')
    or event_action not in (
      'console.read',
      'directory.read',
      'organisation.read',
      'notifications.read',
      'login.attempt',
      'leanai_cost.read'
    )
    or jsonb_typeof(stored_detail) is distinct from 'object'
    or char_length(stored_detail::text) > 1000 then
    raise exception 'platform admin audit event is invalid'
      using errcode = '22023';
  end if;

  insert into private.platform_admin_access_events (
    actor_user_id,
    outcome,
    action,
    request_path,
    resource_id,
    detail
  )
  values (
    actor_user_id,
    event_outcome,
    event_action,
    request_path,
    resource_id,
    stored_detail
  );
end;
$$;

create or replace function private.platform_admin_leanai_cost_governance(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  target_organisation_id uuid default null,
  period_start timestamptz default null,
  period_end timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
  range_start timestamptz;
  range_end timestamptz;
  active_rate_card jsonb;
  fx_row private.platform_fx_reference_rates%rowtype;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  range_end := coalesce(period_end, statement_timestamp());
  range_start := coalesce(
    period_start,
    date_trunc('month', range_end)
  );

  if range_start >= range_end then
    raise exception 'report period is invalid'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
    'version_id', version_row.id,
    'effective_from', version_row.effective_from,
    'source_label', version_row.source_label,
    'currency', version_row.currency,
    'disclaimer',
      'USD planning estimates from versioned internal rate card — not invoices or customer pricing.'
  )
  into active_rate_card
  from private.ai_provider_rate_card_versions version_row
  where version_row.effective_from <= range_end
  order by version_row.effective_from desc
  limit 1;

  select fx_reference.*
  into fx_row
  from private.platform_fx_reference_rates fx_reference
  where fx_reference.effective_from <= range_end
  order by fx_reference.effective_from desc
  limit 1;

  with usage_enriched as (
    select
      usage_row.id as usage_event_id,
      usage_row.organisation_id,
      usage_row.ai_run_id,
      usage_row.provider,
      usage_row.model,
      usage_row.input_tokens,
      usage_row.cached_input_tokens,
      usage_row.output_tokens,
      usage_row.reasoning_tokens,
      usage_row.created_at,
      coalesce(web_counts.web_search_calls, 0) as web_search_calls,
      run_row.prompt_key,
      run_row.status as run_status,
      session_row.context_type,
      session_row.module_key,
      session_row.intervention_key,
      session_row.site_unit_id,
      private.estimate_ai_provider_usage_cost_usd(
        usage_row.provider,
        usage_row.model,
        usage_row.input_tokens,
        usage_row.cached_input_tokens,
        usage_row.output_tokens,
        usage_row.reasoning_tokens,
        coalesce(web_counts.web_search_calls, 0),
        usage_row.created_at
      ) as cost_estimate
    from public.ai_usage_events usage_row
    join public.ai_runs run_row
      on run_row.organisation_id = usage_row.organisation_id
      and run_row.id = usage_row.ai_run_id
    join public.ai_sessions session_row
      on session_row.organisation_id = usage_row.organisation_id
      and session_row.id = usage_row.ai_session_id
    left join lateral (
      select count(*)::integer as web_search_calls
      from public.ai_tool_calls tool_row
      where tool_row.organisation_id = usage_row.organisation_id
        and tool_row.ai_run_id = usage_row.ai_run_id
        and tool_row.tool_name in ('web_search', 'web_search_2025_08_26')
    ) web_counts on true
    where usage_row.created_at >= range_start
      and usage_row.created_at < range_end
      and (
        target_organisation_id is null
        or usage_row.organisation_id = target_organisation_id
      )
  ),
  failed_attempts as (
    select
      run_row.organisation_id,
      count(*)::integer as failed_attempt_count
    from public.ai_runs run_row
    where run_row.completed_at >= range_start
      and run_row.completed_at < range_end
      and run_row.status in ('failed', 'timed_out')
      and (
        target_organisation_id is null
        or run_row.organisation_id = target_organisation_id
      )
      and not exists (
        select 1
        from public.ai_usage_events usage_row
        where usage_row.organisation_id = run_row.organisation_id
          and usage_row.ai_run_id = run_row.id
      )
    group by run_row.organisation_id
  ),
  organisation_subscription as (
    select
      organisation.id as organisation_id,
      organisation.code,
      organisation.name,
      subscription.plan_code,
      subscription.billing_interval,
      subscription.site_quantity,
      private.platform_subscription_is_verified_customer(
        subscription.provider,
        subscription.billing_state
      ) as verified_customer
    from public.organisations organisation
    left join public.organisation_subscriptions subscription
      on subscription.organisation_id = organisation.id
    where target_organisation_id is null
      or organisation.id = target_organisation_id
  ),
  by_organisation as (
    select
      usage_enriched.organisation_id,
      count(*)::integer as usage_event_count,
      count(*) filter (
        where usage_enriched.cost_estimate ->> 'pricing_status' = 'complete'
      )::integer as priced_event_count,
      count(*) filter (
        where usage_enriched.cost_estimate ->> 'pricing_status' <> 'complete'
      )::integer as incomplete_or_unpriced_event_count,
      coalesce(
        sum(
          (usage_enriched.cost_estimate ->> 'estimated_usd')::numeric
        ) filter (
          where usage_enriched.cost_estimate ->> 'pricing_status' = 'complete'
        ),
        0
      ) as estimated_usd_complete,
      coalesce(
        sum(usage_enriched.input_tokens),
        0
      )::bigint as input_tokens,
      coalesce(
        sum(usage_enriched.output_tokens),
        0
      )::bigint as output_tokens
    from usage_enriched
    group by usage_enriched.organisation_id
  )
  select jsonb_build_object(
    'period_start', range_start,
    'period_end', range_end,
    'rate_card', active_rate_card,
    'fx_reference', case
      when fx_row.id is null then null
      else jsonb_build_object(
        'id', fx_row.id,
        'usd_to_gbp', fx_row.rate,
        'effective_from', fx_row.effective_from,
        'source_label', fx_row.source_label,
        'disclaimer',
          'For internal subscription benchmark comparison only — never conflate with billed GBP.'
      )
    end,
    'review_target_ratio', 0.05,
    'disclaimer',
      'Internal operator estimate. Alerts are for review — no automatic customer billing or LeanAI shutdown.',
    'totals', jsonb_build_object(
      'usage_event_count', coalesce((select count(*) from usage_enriched), 0),
      'estimated_usd_complete', coalesce((
        select sum(
          (cost_estimate ->> 'estimated_usd')::numeric
        )
        from usage_enriched
        where cost_estimate ->> 'pricing_status' = 'complete'
      ), 0),
      'incomplete_or_unpriced_event_count', coalesce((
        select count(*)
        from usage_enriched
        where cost_estimate ->> 'pricing_status' <> 'complete'
      ), 0),
      'failed_attempt_count', coalesce((
        select sum(failed_attempt_count) from failed_attempts
      ), 0)
    ),
    'by_model', coalesce((
      select jsonb_agg(row_json order by row_json ->> 'estimated_usd' desc)
      from (
        select jsonb_build_object(
          'provider', usage_enriched.provider,
          'model', usage_enriched.model,
          'usage_event_count', count(*)::integer,
          'estimated_usd_complete', coalesce(
            sum(
              (usage_enriched.cost_estimate ->> 'estimated_usd')::numeric
            ) filter (
              where usage_enriched.cost_estimate ->> 'pricing_status' = 'complete'
            ),
            0
          ),
          'incomplete_or_unpriced_event_count', count(*) filter (
            where usage_enriched.cost_estimate ->> 'pricing_status' <> 'complete'
          )::integer
        ) as row_json
        from usage_enriched
        group by usage_enriched.provider, usage_enriched.model
      ) model_rows
    ), '[]'::jsonb),
    'by_workflow', coalesce((
      select jsonb_agg(row_json order by row_json ->> 'estimated_usd' desc)
      from (
        select jsonb_build_object(
          'workflow_key',
            coalesce(
              usage_enriched.prompt_key,
              usage_enriched.context_type || ':' || coalesce(usage_enriched.module_key, 'unknown')
            ),
          'usage_event_count', count(*)::integer,
          'estimated_usd_complete', coalesce(
            sum(
              (usage_enriched.cost_estimate ->> 'estimated_usd')::numeric
            ) filter (
              where usage_enriched.cost_estimate ->> 'pricing_status' = 'complete'
            ),
            0
          ),
          'incomplete_or_unpriced_event_count', count(*) filter (
            where usage_enriched.cost_estimate ->> 'pricing_status' <> 'complete'
          )::integer
        ) as row_json
        from usage_enriched
        group by 1
      ) workflow_rows
    ), '[]'::jsonb),
    'by_date', coalesce((
      select jsonb_agg(row_json order by row_json ->> 'usage_date')
      from (
        select jsonb_build_object(
          'usage_date', date_trunc('day', usage_enriched.created_at)::date,
          'usage_event_count', count(*)::integer,
          'estimated_usd_complete', coalesce(
            sum(
              (usage_enriched.cost_estimate ->> 'estimated_usd')::numeric
            ) filter (
              where usage_enriched.cost_estimate ->> 'pricing_status' = 'complete'
            ),
            0
          ),
          'failed_attempt_count', 0
        ) as row_json
        from usage_enriched
        group by date_trunc('day', usage_enriched.created_at)::date
      ) date_rows
    ), '[]'::jsonb),
    'by_organisation', coalesce((
      select jsonb_agg(row_json order by row_json ->> 'estimated_usd_complete' desc)
      from (
        select jsonb_build_object(
          'organisation_id', org_row.organisation_id,
          'code', org_row.code,
          'name', org_row.name,
          'usage_event_count', coalesce(by_org.usage_event_count, 0),
          'estimated_usd_complete', coalesce(by_org.estimated_usd_complete, 0),
          'incomplete_or_unpriced_event_count',
            coalesce(by_org.incomplete_or_unpriced_event_count, 0),
          'failed_attempt_count',
            coalesce(failed_attempts.failed_attempt_count, 0),
          'monthly_subscription_revenue_gbp', case
            when org_row.verified_customer then
              private.platform_catalogue_monthly_revenue_gbp(
                org_row.plan_code,
                org_row.billing_interval,
                org_row.site_quantity,
                range_end
              )
            else null
          end,
          'soft_review', case
            when by_org.incomplete_or_unpriced_event_count > 0 then
              jsonb_build_object(
                'exceeds_review_target', false,
                'incomplete_estimate', true,
                'ratio', null
              )
            when fx_row.rate is null
              or coalesce(by_org.estimated_usd_complete, 0) = 0 then
              jsonb_build_object(
                'exceeds_review_target', false,
                'incomplete_estimate', false,
                'ratio', null
              )
            else
              jsonb_build_object(
                'exceeds_review_target',
                  (
                    (by_org.estimated_usd_complete * fx_row.rate)
                    / nullif(
                      private.platform_catalogue_monthly_revenue_gbp(
                        org_row.plan_code,
                        org_row.billing_interval,
                        org_row.site_quantity,
                        range_end
                      ),
                      0
                    )
                  ) > 0.05,
                'incomplete_estimate', false,
                'ratio',
                  (
                    (by_org.estimated_usd_complete * fx_row.rate)
                    / nullif(
                      private.platform_catalogue_monthly_revenue_gbp(
                        org_row.plan_code,
                        org_row.billing_interval,
                        org_row.site_quantity,
                        range_end
                      ),
                      0
                    )
                  )
              )
          end
        ) as row_json
        from organisation_subscription org_row
        left join by_organisation by_org
          on by_org.organisation_id = org_row.organisation_id
        left join failed_attempts
          on failed_attempts.organisation_id = org_row.organisation_id
        where by_org.organisation_id is not null
          or failed_attempts.organisation_id is not null
      ) tenant_rows
    ), '[]'::jsonb)
  )
  into result;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'leanai_cost.read',
    request_path,
    target_organisation_id,
    jsonb_build_object(
      'period_start', range_start,
      'period_end', range_end
    )
  );

  return result;
end;
$$;

create or replace function public.platform_admin_leanai_cost_governance(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  target_organisation_id uuid default null,
  period_start timestamptz default null,
  period_end timestamptz default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_leanai_cost_governance(
    actor_user_id,
    authenticator_assurance_level,
    request_path,
    target_organisation_id,
    period_start,
    period_end
  )
$$;

revoke all on function public.platform_admin_leanai_cost_governance(
  uuid, text, text, uuid, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.platform_admin_leanai_cost_governance(
  uuid, text, text, uuid, timestamptz, timestamptz
) to service_role;

grant execute on function private.platform_admin_leanai_cost_governance(
  uuid, text, text, uuid, timestamptz, timestamptz
) to service_role;

alter function private.estimate_ai_provider_usage_cost_usd(
  text, text, integer, integer, integer, integer, integer, timestamptz
) owner to lean_hub_private_owner;
alter function private.ai_rate_card_version_for_timestamp(timestamptz)
  owner to lean_hub_private_owner;
alter function private.platform_catalogue_monthly_revenue_gbp(
  text, text, integer, timestamptz
) owner to lean_hub_private_owner;
alter function private.platform_admin_leanai_cost_governance(
  uuid, text, text, uuid, timestamptz, timestamptz
) owner to postgres;
