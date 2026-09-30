begin;

select plan(29);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c1950000-0000-4000-8000-000000000001',
  'ai-coach-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1950000-0000-4000-8000-000000000002',
  'ai-coach-unprivileged@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1950000-0000-4000-8000-000000000003',
  'ai-coach-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ai_coach_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ai_coach_ids to authenticated, anon;

insert into ai_coach_ids (key, id)
values
  (
    'organisation_a',
    private.provision_organisation(
      'c1950000-0000-4000-8000-000000000001',
      'ai-coach-org-a',
      'AI Coach Organisation A'
    )
  ),
  (
    'organisation_b',
    private.provision_organisation(
      'c1950000-0000-4000-8000-000000000001',
      'ai-coach-org-b',
      'AI Coach Organisation B'
    )
  ),
  (
    'organisation_outsider',
    private.provision_organisation(
      'c1950000-0000-4000-8000-000000000003',
      'ai-coach-org-out',
      'AI Coach Outsider Organisation'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c1951000-0000-4000-8000-000000000001',
  'c1950000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c1951000-0000-4000-8000-000000000002',
  'c1950000-0000-4000-8000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'c1951000-0000-4000-8000-000000000003',
  'c1950000-0000-4000-8000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select ok(
  (
    select not p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_ai_coach_session'
  ),
  'public create_ai_coach_session is SECURITY INVOKER'
);

select ok(
  (
    select p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'lean_hub_private_owner'
      and p.proconfig = array['search_path=""']::text[]
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'create_ai_coach_session'
  ),
  'private create_ai_coach_session is DEFINER with empty search_path'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_ai_coach_session(text, text, uuid, text, text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute create_ai_coach_session'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000001","email":"ai-coach-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_a')),
  'owner selects organisation A'
);

select throws_ok(
  $$select public.create_ai_coach_session('maturity', 'maturity_first_setup')$$,
  '42501',
  'ai session creation is not authorised',
  'disabled organisation AI blocks coach session creation'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'owner enables organisation AI'
);

select throws_ok(
  $$select public.create_ai_coach_session('not_a_module', 'maturity_first_setup')$$,
  '22023',
  'invalid coach module key',
  'invalid module key is rejected'
);

insert into ai_coach_ids (key, id)
select 'coach_session', public.create_ai_coach_session(
  'maturity',
  'maturity_first_setup',
  null,
  'Maturity setup'
);

select is(
  (
    select count(*)::integer
    from public.problem_solving_cases
    where organisation_id = (select id from ai_coach_ids where key = 'organisation_a')
  ),
  0,
  'coach session creation does not insert a dummy problem solving case'
);

select is(
  (
    select row(
      context_type,
      problem_solving_case_id,
      problem_solving_session_id,
      module_key,
      intervention_key
    )
    from public.ai_sessions
    where id = (select id from ai_coach_ids where key = 'coach_session')
  ),
  row(
    'coach'::text,
    null::uuid,
    null::uuid,
    'maturity'::text,
    'maturity_first_setup'::text
  ),
  'coach session is bound to module context without a case id'
);

insert into ai_coach_ids (key, id)
select 'coach_session_reuse', public.create_ai_coach_session(
  'maturity',
  'maturity_first_setup'
);

select is(
  (select id from ai_coach_ids where key = 'coach_session_reuse'),
  (select id from ai_coach_ids where key = 'coach_session'),
  'creating the same coach context reuses the active session'
);

insert into ai_coach_ids (key, id)
select 'coach_run', public.start_ai_run(
  (select id from ai_coach_ids where key = 'coach_session'),
  'Explain this Maturity setup recommendation.',
  'ai-coach-run-1',
  'fake',
  'gpt-4.1-nano',
  'leanai-coach-explain',
  'v1',
  'hash-coach-1'
);

select is(
  (
    select status
    from public.ai_runs
    where id = (select id from ai_coach_ids where key = 'coach_run')
  ),
  'running',
  'start_ai_run accepts a coach session without a problem solving case'
);

select ok(
  public.finish_ai_run(
    (select id from ai_coach_ids where key = 'coach_run'),
    'Publish a Maturity Framework so assessments share one standard.',
    jsonb_build_object('message', 'Publish a Maturity Framework so assessments share one standard.'),
    'coach-explain-v1',
    jsonb_build_object(
      'context_type', 'coach',
      'logical_model_class', 'economy',
      'intervention_key', 'maturity_first_setup'
    ),
    'manifest-coach-1',
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    12,
    18,
    0,
    0,
    0,
    40
  ) is not null,
  'finish_ai_run records a coach turn'
);

select is(
  (
    select count(*)::integer
    from public.ai_usage_events
    where organisation_id = (select id from ai_coach_ids where key = 'organisation_a')
      and ai_session_id = (select id from ai_coach_ids where key = 'coach_session')
      and model = 'gpt-4.1-nano'
  ),
  1,
  'coach usage is recorded on the existing ledger'
);

reset role;

select throws_ok(
  format(
    $query$
      insert into public.ai_proposals (
        organisation_id,
        ai_session_id,
        ai_run_id,
        proposal_type,
        payload_json,
        human_explanation,
        display_permission_key,
        problem_solving_case_id
      )
      values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'hypothesis',
        '{}'::jsonb,
        'should not persist',
        'problem_solving.manage',
        '00000000-0000-4000-8000-000000000001'::uuid
      )
    $query$,
    (select id from ai_coach_ids where key = 'organisation_a'),
    (select id from ai_coach_ids where key = 'coach_session'),
    (select id from ai_coach_ids where key = 'coach_run')
  ),
  '42501',
  'coach sessions cannot persist problem-solving proposals',
  'coach sessions reject problem-solving proposals'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000003","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000003","email":"ai-coach-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_outsider')),
  'outsider selects their organisation to create a site'
);

insert into ai_coach_ids (key, id)
select 'outsider_site', public.create_organisation_unit(
  (select id from ai_coach_ids where key = 'organisation_outsider'),
  null,
  'ai-coach-out-site',
  'AI Coach Outsider Site',
  'site'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000001","email":"ai-coach-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_a')),
  'owner re-selects organisation A for foreign site probe'
);

select throws_ok(
  format(
    $query$select public.create_ai_coach_session('sites', 'sites_first_setup', %L::uuid)$query$,
    (select id from ai_coach_ids where key = 'outsider_site')
  ),
  '42501',
  'authorised site context is required',
  'coach session cannot bind a site from another organisation'
);

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_b')),
  'owner switches to organisation B'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'owner enables AI on organisation B'
);

insert into ai_coach_ids (key, id)
select 'coach_session_b', public.create_ai_coach_session(
  'maturity',
  'maturity_first_setup'
);

select ok(
  not exists (
    select 1
    from public.ai_sessions session_row
    where session_row.id = (select id from ai_coach_ids where key = 'coach_session')
  ),
  'switching organisation hides the previous organisation coach session'
);

select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from ai_coach_ids where key = 'coach_session')
  ),
  '42501',
  'ai session read is not authorised',
  'organisation B cannot read organisation A coach history'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from ai_coach_ids where key = 'organisation_a'),
    'c1950000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ai_coach_ids (key, id)
select 'unprivileged_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c1950000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000002","email":"ai-coach-unprivileged@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_a')),
  'unprivileged member selects organisation A'
);

select throws_ok(
  $$select public.create_ai_coach_session('maturity', 'maturity_first_setup')$$,
  '42501',
  'ai session creation is not authorised',
  'member without ai.use cannot create a coach session'
);

select ok(
  not exists (
    select 1
    from public.ai_sessions session_row
    where session_row.id = (select id from ai_coach_ids where key = 'coach_session')
  ),
  'member without ai.view_history cannot read another member coach session'
);

-- Hostile privacy test: even an otherwise history-authorised role cannot
-- access a different user's private Coach conversation (PS semantics differ).
reset role;
create or replace function private.can_view_ai_history(target_organisation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $coach_privacy_test$ select true $coach_privacy_test$;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000002","email":"ai-coach-unprivileged@example.test"}',
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from ai_coach_ids where key = 'coach_session')
  ),
  '42501',
  'ai session read is not authorised',
  'ai.view_history cannot expose another member personal Coach conversation'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000003","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000003","email":"ai-coach-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_outsider')),
  'outsider selects their organisation'
);

select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from ai_coach_ids where key = 'coach_session')
  ),
  '42501',
  'ai session read is not authorised',
  'cross-tenant actor cannot read coach session detail'
);

reset role;

update public.organisations
set status = 'suspended',
    status_reason = 'ai coach session probe',
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from ai_coach_ids where key = 'organisation_a');

select set_config(
  'request.jwt.claims',
  '{"sub":"c1950000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c1951000-0000-4000-8000-000000000001","email":"ai-coach-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_coach_ids where key = 'organisation_a')),
  'owner can still select a suspended organisation'
);

select throws_ok(
  $$select public.create_ai_coach_session('maturity', 'maturity_first_setup')$$,
  '42501',
  'ai session creation is not authorised',
  'suspended organisation cannot create a coach session'
);

reset role;

select * from finish();
rollback;
