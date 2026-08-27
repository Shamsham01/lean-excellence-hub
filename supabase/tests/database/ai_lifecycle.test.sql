begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1400000-0000-0000-0000-000000000001',
  'ai-lifecycle-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ai_lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ai_lifecycle_ids to authenticated;

insert into ai_lifecycle_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1400000-0000-0000-0000-000000000001',
    'ai-lifecycle-org',
    'AI Lifecycle Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1410000-0000-0000-0000-000000000001',
  'a1400000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1400000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1410000-0000-0000-0000-000000000001","email":"ai-lifecycle-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_lifecycle_ids where key = 'organisation')),
  'owner selects organisation'
);

select throws_ok(
  $$select public.create_ai_session(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'ask'
  )$$,
  '42501',
  'ai session creation is not authorised',
  'ai disabled blocks session creation before settings update'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'owner enables organisation ai settings'
);

insert into ai_lifecycle_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ai_lifecycle_ids where key = 'organisation'),
  null,
  'ai-lifecycle-site',
  'AI Lifecycle Site',
  'site'
);

insert into ai_lifecycle_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'AI lifecycle case',
  (select id from ai_lifecycle_ids where key = 'unit_root'),
  'Recurring quality defect on assembly line'
);

insert into ai_lifecycle_ids (key, id)
select 'ai_session', public.create_ai_session(
  (select id from ai_lifecycle_ids where key = 'case'),
  'facilitate'
);

select ok(
  (select id from ai_lifecycle_ids where key = 'ai_session') is not null,
  'authorised user creates ai session when ai is enabled'
);

insert into ai_lifecycle_ids (key, id)
select 'ai_run', public.start_ai_run(
  (select id from ai_lifecycle_ids where key = 'ai_session'),
  'What gaps should we examine first?',
  'ai-lifecycle-run-1',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v1',
  'hash-1'
);

select is(
  (select status from public.ai_runs
   where id = (select id from ai_lifecycle_ids where key = 'ai_run')),
  'running',
  'start_ai_run creates a running run'
);

select throws_ok(
  format(
    $query$
      select public.start_ai_run(
        %L::uuid,
        'Second concurrent run',
        'ai-lifecycle-run-2',
        'fake',
        'fake-model',
        'problem_solving_facilitator',
        'v1',
        'hash-2'
      )
    $query$,
    (select id from ai_lifecycle_ids where key = 'ai_session')
  ),
  '23505',
  null,
  'second concurrent run on same session is rejected'
);

select ok(
  public.finish_ai_run(
    (select id from ai_lifecycle_ids where key = 'ai_run'),
    'Measured facts and assumptions are recorded separately.',
    jsonb_build_object(
      'message', 'Measured facts and assumptions are recorded separately.',
      'observations', '[]'::jsonb,
      'questions', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'source_refs', '[]'::jsonb,
      'proposals', '[]'::jsonb
    ),
    'v1',
    jsonb_build_object('case_id', (select id from ai_lifecycle_ids where key = 'case')),
    'manifest-hash-1',
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'proposal_type', 'current_condition_item',
        'payload_json', jsonb_build_object(
          'category', 'measured_fact',
          'statement', 'Defect ppm increased during hot runs.'
        ),
        'human_explanation', 'Record measured hot-run defect rate.',
        'display_permission_key', 'problem_solving.contribute'
      )
    ),
    40,
    80,
    0,
    0,
    0,
    120
  ) is not null,
  'finish_ai_run completes run and stores pending proposal'
);

select ok(
  exists (
    select 1
    from public.ai_proposals proposal_row
    where proposal_row.ai_session_id = (select id from ai_lifecycle_ids where key = 'ai_session')
      and proposal_row.status = 'pending'
      and proposal_row.proposal_type = 'current_condition_item'
  ),
  'finish_ai_run persists pending proposal rows'
);

select ok(
  exists (
    select 1
    from public.ai_usage_events usage_row
    where usage_row.organisation_id = (select id from ai_lifecycle_ids where key = 'organisation')
      and usage_row.ai_run_id = (select id from ai_lifecycle_ids where key = 'ai_run')
  ),
  'finish_ai_run appends usage ledger event'
);

insert into ai_lifecycle_ids (key, id)
select 'ai_run_2', public.start_ai_run(
  (select id from ai_lifecycle_ids where key = 'ai_session'),
  'Follow-up question',
  'ai-lifecycle-run-3',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v1',
  'hash-3'
);

select throws_ok(
  format(
    $query$
      select public.finish_ai_run(
        %L::uuid,
        'Forbidden close proposal',
        jsonb_build_object(
          'message', 'Forbidden',
          'observations', '[]'::jsonb,
          'questions', '[]'::jsonb,
          'warnings', '[]'::jsonb,
          'source_refs', '[]'::jsonb,
          'proposals', '[]'::jsonb
        ),
        'v1',
        '{}'::jsonb,
        'hash-forbidden',
        null,
        '[]'::jsonb,
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object(
            'proposal_type', 'close_case',
            'payload_json', '{}'::jsonb,
            'human_explanation', 'Close case',
            'display_permission_key', 'problem_solving.manage'
          )
        ),
        10,
        10,
        0,
        0,
        0,
        10
      )
    $query$,
    (select id from ai_lifecycle_ids where key = 'ai_run_2')
  ),
  '22023',
  'forbidden ai proposal type',
  'finish_ai_run rejects forbidden proposal types at database layer'
);

reset role;

select * from finish();
rollback;
