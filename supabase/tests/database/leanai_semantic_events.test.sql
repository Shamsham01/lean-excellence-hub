begin;

select plan(27);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b1850000-0000-4000-8000-000000000001',
    'leanai-context-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1850000-0000-4000-8000-000000000002',
    'leanai-context-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table leanai_context_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on leanai_context_ids to authenticated, anon;

insert into leanai_context_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'b1850000-0000-4000-8000-000000000001',
      'leanai-context-a',
      'LeanAI Context A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'b1850000-0000-4000-8000-000000000001',
      'leanai-context-b',
      'LeanAI Context B'
    )
  ),
  (
    'org_c',
    private.provision_organisation(
      'b1850000-0000-4000-8000-000000000002',
      'leanai-context-c',
      'LeanAI Context C'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'b1851000-0000-4000-8000-000000000001',
    'b1850000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b1851000-0000-4000-8000-000000000002',
    'b1850000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select ok(
  not pg_catalog.has_table_privilege('anon', 'public.leanai_semantic_events', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.leanai_semantic_events', 'INSERT')
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.get_leanai_contextual_snapshot()',
    'EXECUTE'
  ),
  'anonymous callers have no event table or RPC access'
);

select ok(
  pg_catalog.has_table_privilege('authenticated', 'public.leanai_semantic_events', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.leanai_semantic_events', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.leanai_semantic_events', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.leanai_semantic_events', 'DELETE'),
  'authenticated members can select own events but cannot write the table directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1850000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b1851000-0000-4000-8000-000000000001","email":"leanai-context-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_context_ids where key = 'org_a')),
  'owner selects organisation A'
);

select is(
  public.get_leanai_contextual_snapshot() ->> 'proactive_assistance_enabled',
  'true',
  'existing snapshot RPC exposes proactive assistance without a new public SECURITY DEFINER'
);

insert into leanai_context_ids (key, id)
select 'event_a', public.record_leanai_semantic_event(
  'module.opened',
  1,
  'maturity',
  null,
  null,
  '{}'::jsonb,
  null
);

select is(
  (
    select count(*)
    from public.leanai_semantic_events
    where organisation_id = (select id from leanai_context_ids where key = 'org_a')
      and event_key = 'module.opened'
  ),
  1::bigint,
  'current organisation can persist a bounded semantic event'
);

select is(
  (
    select recent_module_key
    from public.leanai_journey_contexts
    where organisation_id = (select id from leanai_context_ids where key = 'org_a')
  ),
  'maturity',
  'module.opened updates compact journey context'
);

select throws_ok(
  $$select public.record_leanai_semantic_event('dom.click')$$,
  '23514',
  'leanai event key is not in the bounded taxonomy',
  'unbounded event keys are rejected'
);

select throws_ok(
  $$select public.record_leanai_semantic_event(
    'module.opened', 1, 'maturity', null, null,
    '{"click":"button","x":12}'::jsonb, null
  )$$,
  '23514',
  'leanai event metadata must not record surveillance or secret fields',
  'clickstream metadata is rejected'
);

select throws_ok(
  $$select public.record_leanai_semantic_event(
    'module.opened', 1, 'maturity', null, null,
    '{"note":{"nested":true}}'::jsonb, null
  )$$,
  '23514',
  'leanai event metadata values must be scalar',
  'nested metadata blobs are rejected'
);

select throws_ok(
  $$select public.record_leanai_semantic_event('module.opened')$$,
  '23514',
  'module.opened requires a bounded module key',
  'module.opened without a module key is rejected'
);

select lives_ok(
  $$select public.record_leanai_semantic_event(
    'leanai.intervention_shown', 1, 'maturity', 'maturity_first_setup', null,
    '{}'::jsonb, null
  )$$,
  'intervention shown can be recorded'
);

select lives_ok(
  $$select public.record_leanai_semantic_event(
    'leanai.intervention_snoozed', 1, 'maturity', 'maturity_first_setup', null,
    '{"snooze_minutes":60}'::jsonb, null
  )$$,
  'intervention snooze updates cooldown state'
);

select ok(
  (
    select snoozed_until is not null
    from public.leanai_intervention_states
    where organisation_id = (select id from leanai_context_ids where key = 'org_a')
      and intervention_key = 'maturity_first_setup'
  ),
  'snooze writes current-state cooldown rather than a dismissal count'
);

select is(
  (
    select count(*)
    from public.leanai_semantic_events
    where organisation_id = (select id from leanai_context_ids where key = 'org_b')
  ),
  0::bigint,
  'organisation A cannot read organisation B events'
);

select ok(
  public.switch_organisation((select id from leanai_context_ids where key = 'org_b')),
  'same identity switches to organisation B'
);

select is(
  (
    select count(*)
    from public.leanai_semantic_events
  ),
  0::bigint,
  'same identity in organisation B cannot see organisation A journey events'
);

insert into leanai_context_ids (key, id)
select 'event_b', public.record_leanai_semantic_event(
  'onboarding.step_skipped',
  1,
  'onboarding',
  null,
  null,
  '{"step_key":"structure"}'::jsonb,
  null
);

select is(
  public.get_leanai_journey_context() ->> 'onboarding_status',
  'in_progress',
  'organisation B journey context is independent'
);

select is(
  public.get_leanai_journey_context() ->> 'recent_module_key',
  null,
  'organisation B does not inherit organisation A module context'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1850000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b1851000-0000-4000-8000-000000000002","email":"leanai-context-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_context_ids where key = 'org_c')),
  'foreign owner selects organisation C'
);

select is(
  (
    select count(*)
    from public.leanai_semantic_events
    where id = (select id from leanai_context_ids where key = 'event_a')
  ),
  0::bigint,
  'foreign organisation cannot read organisation A events'
);

select throws_ok(
  format(
    $$insert into public.leanai_semantic_events (
      organisation_id, membership_id, event_key
    ) values (%L::uuid, 'b1850000-0000-4000-8000-000000000001', 'module.opened')$$,
    (select id from leanai_context_ids where key = 'org_a')
  ),
  '42501',
  null,
  'foreign organisation event write through the table is denied'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.record_leanai_semantic_event('module.opened', 1, 'maturity')$$,
  '42501',
  null,
  'anonymous callers cannot record semantic events'
);

reset role;

insert into public.leanai_semantic_events (
  organisation_id,
  membership_id,
  event_key,
  module_key,
  metadata,
  occurred_at
)
select
  membership_row.organisation_id,
  membership_row.id,
  'module.opened',
  'setup',
  '{}'::jsonb,
  statement_timestamp() - interval '120 days'
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from leanai_context_ids where key = 'org_a')
  and membership_row.user_id = 'b1850000-0000-4000-8000-000000000001'
limit 1;

select is(
  private.cleanup_expired_leanai_semantic_events(
    (select id from leanai_context_ids where key = 'org_a')
  ) >= 1,
  true,
  'retention cleanup deletes expired journey events'
);

select ok(
  exists (
    select 1
    from public.leanai_intervention_states
    where organisation_id = (select id from leanai_context_ids where key = 'org_a')
      and intervention_key = 'maturity_first_setup'
      and snoozed_until is not null
  ),
  'retention cleanup preserves intervention cooldown current-state'
);

select ok(
  (
    select count(*) = 0
    from public.leanai_semantic_events
    where organisation_id = (select id from leanai_context_ids where key = 'org_a')
      and occurred_at < statement_timestamp() - interval '90 days'
  ),
  'expired events are absent after cleanup'
);

select throws_ok(
  $$select public.cleanup_expired_leanai_semantic_events(null)$$,
  '42883',
  null,
  'expired event cleanup is not exposed as a public RPC'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'leanai_semantic_events'
      and indexdef ilike '%organisation_id%site_unit_id%'
  ),
  'site foreign key has a covering index'
);

select * from finish();

rollback;
