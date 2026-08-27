begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1c00000-0000-0000-0000-000000000001',
  'ps-sessions-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1c00000-0000-0000-0000-000000000002',
  'ps-sessions-contributor@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_session_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_session_ids to authenticated;

insert into ps_session_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1c00000-0000-0000-0000-000000000001',
    'ps-sessions-org',
    'Problem Solving Sessions Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1c10000-0000-0000-0000-000000000001',
  'a1c00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1c10000-0000-0000-0000-000000000002',
  'a1c00000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1c00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1c10000-0000-0000-0000-000000000001","email":"ps-sessions-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_session_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_session_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_session_ids where key = 'organisation'),
  null,
  'session-site',
  'Session Site',
  'site'
);

insert into ps_session_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_session_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_session_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Session case',
  (select id from ps_session_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_session_ids where key = 'case'),
    (select id from ps_session_ids where key = 'rapid_method')
  ),
  'case activates for session tests'
);

insert into ps_session_ids (key, id)
select 'session', public.start_problem_solving_session(
  (select id from ps_session_ids where key = 'case'),
  'Initial problem solving workshop'
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
    (select id from ps_session_ids where key = 'organisation'),
    'a1c00000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_session_ids (key, id)
select 'contributor_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1c00000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1c00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1c10000-0000-0000-0000-000000000001","email":"ps-sessions-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_problem_solving_participant(
    (select id from ps_session_ids where key = 'case'),
    (select id from ps_session_ids where key = 'contributor_membership'),
    'contributor'
  ) is not null,
  'contributor is added as case participant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1c00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1c10000-0000-0000-0000-000000000002","email":"ps-sessions-contributor@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_session_ids where key = 'organisation')),
  'contributor selects organisation'
);

insert into ps_session_ids (key, id)
select 'contributor_entry', public.add_session_entry(
  (select id from ps_session_ids where key = 'session'),
  'observation',
  'Operator noted vibration before shutdown'
);

insert into ps_session_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_session_ids where key = 'organisation')
  and membership_row.user_id = 'a1c00000-0000-0000-0000-000000000001';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1c00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1c10000-0000-0000-0000-000000000001","email":"ps-sessions-owner@example.test"}',
  true
);

select ok(
  public.complete_problem_solving_session(
    (select id from ps_session_ids where key = 'session'),
    'Captured initial observations and next steps'
  ),
  'owner completes session'
);

select is(
  (
    select created_by_membership_id
    from public.problem_solving_session_entries entry_row
    where entry_row.id = (select id from ps_session_ids where key = 'contributor_entry')
  ),
  (select id from ps_session_ids where key = 'contributor_membership'),
  'completed session preserves entry authorship'
);

reset role;

select throws_ok(
  format(
    'update public.problem_solving_session_entries set body = %L where id = %L::uuid',
    'Tampered observation',
    (select id from ps_session_ids where key = 'contributor_entry')
  ),
  'completed session entries are immutable',
  '55000'
);

select throws_ok(
  format(
    'insert into public.problem_solving_session_entries (organisation_id, session_id, entry_type, body, created_by_membership_id) values (%L::uuid, %L::uuid, %L, %L, %L::uuid)',
    (select id from ps_session_ids where key = 'organisation'),
    (select id from ps_session_ids where key = 'session'),
    'note',
    'Late entry after completion',
    (select id from ps_session_ids where key = 'owner_membership')
  ),
  'completed session entries are immutable',
  '55000'
);

select * from finish();
rollback;
