begin;

select plan(12);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1400000-0000-0000-0000-000000000001',
  'ps-participant-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1400000-0000-0000-0000-000000000002',
  'ps-participant-contributor@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_participant_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_participant_ids to authenticated;

insert into ps_participant_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1400000-0000-0000-0000-000000000001',
    'ps-participant-org',
    'Problem Solving Participant Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1410000-0000-0000-0000-000000000001',
  'a1400000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1410000-0000-0000-0000-000000000002',
  'a1400000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1400000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1410000-0000-0000-0000-000000000001","email":"ps-participant-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_participant_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_participant_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_participant_ids where key = 'organisation'),
  null,
  'participant-site',
  'Participant Site',
  'site'
);

insert into ps_participant_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_participant_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_participant_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Participant access case',
  (select id from ps_participant_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_participant_ids where key = 'case'),
    (select id from ps_participant_ids where key = 'rapid_method')
  ),
  'owner activates case for participant flow'
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
    (select id from ps_participant_ids where key = 'organisation'),
    'a1400000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_participant_ids (key, id)
select 'contributor_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1400000-0000-0000-0000-000000000002';

insert into ps_participant_ids (key, id)
select 'contributor_role_version', public.create_role_draft(
  (select id from ps_participant_ids where key = 'organisation'),
  'problem-solving-contributor-only',
  'Problem Solving Contributor Only',
  'Contribute to cases without verify or manage permissions'
);

select ok(
  public.add_role_permission(
    (select id from ps_participant_ids where key = 'organisation'),
    (select id from ps_participant_ids where key = 'contributor_role_version'),
    'problem_solving.view'
  ),
  'contributor role receives problem_solving.view'
);

select ok(
  public.add_role_permission(
    (select id from ps_participant_ids where key = 'organisation'),
    (select id from ps_participant_ids where key = 'contributor_role_version'),
    'problem_solving.contribute'
  ),
  'contributor role receives problem_solving.contribute'
);

select ok(
  public.publish_role_version(
    (select id from ps_participant_ids where key = 'organisation'),
    (select id from ps_participant_ids where key = 'contributor_role_version')
  ),
  'contributor role publishes'
);

insert into ps_participant_ids (key, id)
select 'contributor_grant', public.grant_role_version(
  (select id from ps_participant_ids where key = 'organisation'),
  (select id from ps_participant_ids where key = 'contributor_membership'),
  (select id from ps_participant_ids where key = 'contributor_role_version'),
  'organisation',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1400000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1410000-0000-0000-0000-000000000001","email":"ps-participant-owner@example.test"}',
  true
);
set local role authenticated;

insert into ps_participant_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_participant_ids where key = 'organisation')
  and membership_row.user_id = 'a1400000-0000-0000-0000-000000000001';

insert into ps_participant_ids (key, id)
select 'hypothesis', public.create_hypothesis(
  (select id from ps_participant_ids where key = 'case'),
  'Worn belt causes slippage'
);

select ok(
  public.update_hypothesis_status(
    (select id from ps_participant_ids where key = 'hypothesis'),
    'supported',
    'Leading hypothesis for verify_cause permission probe'
  ),
  'hypothesis advances to supported before verify_cause permission probe'
);

insert into ps_participant_ids (key, id)
select 'contributor_participant', public.add_problem_solving_participant(
  (select id from ps_participant_ids where key = 'case'),
  (select id from ps_participant_ids where key = 'contributor_membership'),
  'contributor'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1400000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1410000-0000-0000-0000-000000000002","email":"ps-participant-contributor@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_participant_ids where key = 'organisation')),
  'contributor selects organisation'
);

select ok(
  public.get_problem_solving_detail((select id from ps_participant_ids where key = 'case')) is not null,
  'participant can read authorised case detail'
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    (select id from ps_participant_ids where key = 'hypothesis'),
    'Participant cannot verify without verify_cause permission'
  ),
  'verify_cause permission is required',
  '42501'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from ps_participant_ids where key = 'case'),
    'resolved_verified_cause',
    'Participant attempted closure'
  ),
  'case closure is not authorised',
  '42501'
);

select throws_ok(
  format(
    'select public.cancel_problem_solving_case(%L::uuid, %L)',
    (select id from ps_participant_ids where key = 'case'),
    'Participant attempted cancellation'
  ),
  'case cancellation is not authorised',
  '42501'
);

select throws_ok(
  format(
    'select public.create_containment(%L::uuid, %L)',
    (select id from ps_participant_ids where key = 'case'),
    'Participant attempted containment'
  ),
  'containment creation is not authorised',
  '42501'
);

select * from finish();
rollback;
