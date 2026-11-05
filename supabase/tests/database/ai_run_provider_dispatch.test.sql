begin;

select plan(17);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1700000-0000-0000-0000-000000000001',
  'ai-dispatch-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1700000-0000-0000-0000-000000000002',
  'ai-dispatch-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ai_dispatch_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ai_dispatch_ids to authenticated;

insert into ai_dispatch_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1700000-0000-0000-0000-000000000001',
    'ai-dispatch-org',
    'AI Dispatch Organisation'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'a1700000-0000-0000-0000-000000000002',
    'ai-dispatch-other-org',
    'AI Dispatch Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1710000-0000-0000-0000-000000000001',
  'a1700000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1710000-0000-0000-0000-000000000002',
  'a1700000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ai-dispatch-owner@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from ai_dispatch_ids where key = 'organisation'));
select public.update_organisation_ai_settings(true, 100000);

insert into ai_dispatch_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ai_dispatch_ids where key = 'organisation'),
  null,
  'ai-dispatch-site',
  'AI Dispatch Site',
  'site'
);

insert into ai_dispatch_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'AI dispatch case',
  (select id from ai_dispatch_ids where key = 'unit_root'),
  'Seal defects during hot runs'
);

insert into ai_dispatch_ids (key, id)
select 'ai_session', public.create_ai_session(
  (select id from ai_dispatch_ids where key = 'case'),
  'facilitate'
);

insert into ai_dispatch_ids (key, id)
select 'ai_run', public.start_ai_run(
  (select id from ai_dispatch_ids where key = 'ai_session'),
  'Help with 5 Whys for the seal defect.',
  'ai-dispatch-run-1',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v5',
  'hash-dispatch'
);

select lives_ok(
  format(
    'select public.record_ai_run_provider_dispatch(%L::uuid)',
    (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  'dispatch recording succeeds for the run owner'
);

select is(
  (
    select provider_dispatched_at is not null
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  true,
  'dispatch stores a provider_dispatched_at timestamp'
);

select lives_ok(
  format(
    'select public.record_ai_run_provider_dispatch(%L::uuid)',
    (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  'dispatch recording is idempotent'
);

select is(
  (
    select count(*)
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run')
      and provider_dispatched_at is not null
  )::integer,
  1,
  'idempotent dispatch keeps a single timestamp'
);

select is(
  public.recover_stale_ai_runs_for_problem_solving_case(
    (select id from ai_dispatch_ids where key = 'case')
  ),
  0,
  'case recovery does not settle a run younger than the server minimum stale window'
);

select is(
  (
    select status
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  'running',
  'fresh run stays running when recovery uses the enforced minimum threshold'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ai-dispatch-owner@example.test"}',
  true
);

select is(
  private.recover_stale_ai_runs_for_problem_solving_case(
    (select id from ai_dispatch_ids where key = 'case'),
    1
  ),
  0,
  'a one-second threshold is clamped to 65 seconds and cannot settle a fresh run'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.recover_stale_ai_runs_for_problem_solving_case(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated role cannot execute private stale recovery directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.record_ai_run_provider_dispatch(uuid)',
    'EXECUTE'
  ),
  'authenticated role cannot execute private provider dispatch directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.fail_ai_run(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated role cannot execute private fail_ai_run directly'
);
set local role authenticated;
select public.switch_organisation((select id from ai_dispatch_ids where key = 'organisation'));

reset role;
update public.ai_runs
set started_at = statement_timestamp() - interval '2 minutes'
where id = (select id from ai_dispatch_ids where key = 'ai_run');
select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ai-dispatch-owner@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from ai_dispatch_ids where key = 'organisation'));

select is(
  public.recover_stale_ai_runs_for_problem_solving_case(
    (select id from ai_dispatch_ids where key = 'case')
  ),
  1,
  'case recovery closes a stale running row for the owner'
);

select is(
  (
    select status
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  'failed',
  'dispatched-but-unsettled runs fail with billing uncertainty category'
);

select is(
  (
    select error_category
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run')
  ),
  'interrupted_unknown_billing',
  'stale recovery records interrupted_unknown_billing when dispatch evidence exists'
);

insert into ai_dispatch_ids (key, id)
select 'ai_run_2', public.start_ai_run(
  (select id from ai_dispatch_ids where key = 'ai_session'),
  'Second turn for stale timeout classification.',
  'ai-dispatch-run-2',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v5',
  'hash-dispatch-2'
);

reset role;
update public.ai_runs
set started_at = statement_timestamp() - interval '2 minutes'
where id = (select id from ai_dispatch_ids where key = 'ai_run_2');
select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ai-dispatch-owner@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from ai_dispatch_ids where key = 'organisation'));

select is(
  public.recover_stale_ai_runs_for_problem_solving_case(
    (select id from ai_dispatch_ids where key = 'case')
  ),
  1,
  'case recovery also closes runs without dispatch evidence'
);

select is(
  (
    select error_category
    from public.ai_runs
    where id = (select id from ai_dispatch_ids where key = 'ai_run_2')
  ),
  'timeout',
  'runs without dispatch evidence settle as timeout'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000002","email":"ai-dispatch-other@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from ai_dispatch_ids where key = 'other_organisation'));

select throws_ok(
  format(
    'select public.record_ai_run_provider_dispatch(%L::uuid)',
    (select id from ai_dispatch_ids where key = 'ai_run_2')
  ),
  'P0002',
  'ai run not found',
  'another organisation cannot record dispatch on a foreign run'
);

select throws_ok(
  format(
    'select public.recover_stale_ai_runs_for_problem_solving_case(%L::uuid)',
    (select id from ai_dispatch_ids where key = 'case')
  ),
  '42501',
  'problem solving case access required',
  'another organisation cannot recover runs on a foreign case'
);

select *
from finish();

rollback;
