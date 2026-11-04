begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1600000-0000-0000-0000-000000000001',
  'ai-claim-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1600000-0000-0000-0000-000000000002',
  'ai-claim-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ai_claim_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ai_claim_ids to authenticated;

insert into ai_claim_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1600000-0000-0000-0000-000000000001',
    'ai-claim-org',
    'AI Claim Organisation'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'a1600000-0000-0000-0000-000000000002',
    'ai-claim-other-org',
    'AI Claim Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1610000-0000-0000-0000-000000000001',
  'a1600000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1610000-0000-0000-0000-000000000002',
  'a1600000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1600000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1610000-0000-0000-0000-000000000001","email":"ai-claim-owner@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from ai_claim_ids where key = 'organisation'));
select public.update_organisation_ai_settings(true, 100000);

insert into ai_claim_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ai_claim_ids where key = 'organisation'),
  null,
  'ai-claim-site',
  'AI Claim Site',
  'site'
);

insert into ai_claim_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'AI claim case',
  (select id from ai_claim_ids where key = 'unit_root'),
  'Seal defects during hot runs'
);

insert into ai_claim_ids (key, id)
select 'ai_session', public.create_ai_session(
  (select id from ai_claim_ids where key = 'case'),
  'facilitate'
);

insert into ai_claim_ids (key, id)
select 'ai_run', public.start_ai_run(
  (select id from ai_claim_ids where key = 'ai_session'),
  'Help with 5 Whys for the seal defect.',
  'ai-claim-run-1',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v5',
  'hash-claim'
);

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run')),
  'claimed',
  'first claim grants exclusive provider execution'
);

select is(
  (
    select execution_claimed_at is not null
    from public.ai_runs
    where id = (select id from ai_claim_ids where key = 'ai_run')
  ),
  true,
  'claim stores an execution lease timestamp'
);

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run')),
  'in_progress',
  'a second claim for the same running run does not grant another execution'
);

select lives_ok(
  format(
    'select public.fail_ai_run(%L::uuid, %L, %L)',
    (select id from ai_claim_ids where key = 'ai_run'),
    'timeout',
    'stale'
  ),
  'stale recovery closes the claimed run without writing a proposal'
);

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run')),
  'timed_out',
  'a timed-out run is not claimed again'
);

insert into ai_claim_ids (key, id)
select 'ai_run_2', public.start_ai_run(
  (select id from ai_claim_ids where key = 'ai_session'),
  'Review the 5 Whys chain.',
  'ai-claim-run-2',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v5',
  'hash-claim-2'
);

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run_2')),
  'claimed',
  'a new run can be claimed after the previous run is closed'
);

select public.finish_ai_run(
  (select id from ai_claim_ids where key = 'ai_run_2'),
  'Recovered 5 Whys guidance.',
  jsonb_build_object(
    'message', 'Recovered 5 Whys guidance.',
    'observations', '[]'::jsonb,
    'questions', '[]'::jsonb,
    'warnings', '[]'::jsonb,
    'source_refs', '[]'::jsonb,
    'proposals', '[]'::jsonb
  ),
  'v1',
  jsonb_build_object('case_id', (select id from ai_claim_ids where key = 'case')),
  'manifest-hash-claim',
  null,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  10,
  20,
  0,
  0,
  0,
  30
);

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run_2')),
  'completed',
  'a completed run is reconciled instead of claimed again'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1600000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1610000-0000-0000-0000-000000000002","email":"ai-claim-other@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from ai_claim_ids where key = 'other_organisation'));

select is(
  public.claim_ai_run_execution((select id from ai_claim_ids where key = 'ai_run_2')),
  'not_found',
  'another organisation cannot claim or observe the run'
);

select *
from finish();

rollback;
