begin;

select plan(20);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1500000-0000-0000-0000-000000000001',
  'ps-baseline-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1500000-0000-0000-0000-000000000002',
  'ps-baseline-operator@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1500000-0000-0000-0000-000000000003',
  'ps-baseline-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_baseline_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_baseline_ids to authenticated;

insert into ps_baseline_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1500000-0000-0000-0000-000000000001',
    'ps-baseline-org',
    'Problem Solving Baseline Record Auth Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1510000-0000-0000-0000-000000000001',
  'a1500000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1510000-0000-0000-0000-000000000002',
  'a1500000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a1510000-0000-0000-0000-000000000003',
  'a1500000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ps-baseline-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_baseline_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from ps_baseline_ids where key = 'organisation'),
  null,
  'baseline-site',
  'Baseline Site',
  'site'
);

insert into ps_baseline_ids (key, id)
select 'packing', public.create_organisation_unit(
  (select id from ps_baseline_ids where key = 'organisation'),
  (select id from ps_baseline_ids where key = 'site'),
  'baseline-packing',
  'Packing',
  'department'
);

insert into ps_baseline_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from ps_baseline_ids where key = 'organisation'),
  null,
  'baseline-exeter-site',
  'Exeter Site',
  'site'
);

insert into ps_baseline_ids (key, id)
select 'exeter_packing', public.create_organisation_unit(
  (select id from ps_baseline_ids where key = 'organisation'),
  (select id from ps_baseline_ids where key = 'exeter_site'),
  'baseline-exeter-packing',
  'Exeter Packing',
  'department'
);

insert into ps_baseline_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into ps_baseline_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_baseline_ids where key = 'organisation')
  and membership_row.user_id = 'a1500000-0000-0000-0000-000000000001';

reset role;

with inserted_operator_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from ps_baseline_ids where key = 'organisation'),
    'a1500000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_baseline_ids (key, id)
select 'operator_membership', id from inserted_operator_membership;

with inserted_outsider_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from ps_baseline_ids where key = 'organisation'),
    'a1500000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_baseline_ids (key, id)
select 'outsider_membership', id from inserted_outsider_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'a1500000-0000-0000-0000-000000000001',
  'a1500000-0000-0000-0000-000000000002',
  'a1500000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ps-baseline-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'owner re-selects organisation after membership provisioning'
);

select ok(
  public.assign_membership_job_function(
    (select id from ps_baseline_ids where key = 'owner_membership'),
    (select id from ps_baseline_ids where key = 'job_function'),
    true,
    (select id from ps_baseline_ids where key = 'packing')
  ) is not null,
  'owner primary placement for seeding'
);

select ok(
  public.assign_membership_job_function(
    (select id from ps_baseline_ids where key = 'operator_membership'),
    (select id from ps_baseline_ids where key = 'job_function'),
    true,
    (select id from ps_baseline_ids where key = 'packing')
  ) is not null,
  'baseline operator placed at home site packing unit'
);

select ok(
  public.assign_membership_job_function(
    (select id from ps_baseline_ids where key = 'outsider_membership'),
    (select id from ps_baseline_ids where key = 'job_function'),
    true,
    (select id from ps_baseline_ids where key = 'exeter_packing')
  ) is not null,
  'outsider placed at Exeter packing unit'
);

insert into ps_baseline_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Same-site baseline hostile case',
  (select id from ps_baseline_ids where key = 'packing'),
  'Operator must not read without record authority'
);

insert into ps_baseline_ids (key, id)
select 'exeter_case', public.create_problem_solving_case_draft(
  'Cross-site hostile case',
  (select id from ps_baseline_ids where key = 'exeter_packing'),
  'Bodmin actor must not read Exeter case'
);

insert into ps_baseline_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_baseline_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

select ok(
  public.activate_problem_solving_case(
    (select id from ps_baseline_ids where key = 'case'),
    (select id from ps_baseline_ids where key = 'rapid_method')
  ),
  'same-site case activates'
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_baseline_ids where key = 'exeter_case'),
    (select id from ps_baseline_ids where key = 'rapid_method')
  ),
  'Exeter case activates'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000002","email":"ps-baseline-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'baseline operator selects organisation'
);

select ok(
  public.member_has_permission('problem_solving.view'),
  'baseline operator retains problem_solving.view navigation probe'
);

select is(
  (select count(*)::integer from public.problem_solving_cases
    where id = (select id from ps_baseline_ids where key = 'case')),
  0,
  'baseline operator cannot RLS-read arbitrary same-site case'
);

select throws_ok(
  format(
    'select public.get_problem_solving_detail(%L::uuid)',
    (select id from ps_baseline_ids where key = 'case')
  ),
  '42501',
  'problem solving detail is not authorised',
  'baseline operator cannot read same-site case detail by known UUID'
);

select throws_ok(
  format(
    'select public.get_problem_solving_detail(%L::uuid)',
    (select id from ps_baseline_ids where key = 'exeter_case')
  ),
  '42501',
  'problem solving detail is not authorised',
  'baseline operator cannot read cross-site case detail by known UUID'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ps-baseline-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'owner selects organisation for participant grant'
);

select ok(
  public.add_problem_solving_participant(
    (select id from ps_baseline_ids where key = 'case'),
    (select id from ps_baseline_ids where key = 'operator_membership'),
    'contributor'
  ) is not null,
  'owner adds baseline operator as participant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000002","email":"ps-baseline-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'participant operator re-selects organisation'
);

select ok(
  public.get_problem_solving_detail((select id from ps_baseline_ids where key = 'case')) is not null,
  'participant operator can read authorised case detail'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ps-baseline-owner@example.test"}',
  true
);

insert into ps_baseline_ids (key, id)
select 'ps_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from ps_baseline_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'problem_solving'
  and role_version.status = 'published';

select ok(
  public.grant_role_version(
    (select id from ps_baseline_ids where key = 'organisation'),
    (select id from ps_baseline_ids where key = 'outsider_membership'),
    (select id from ps_baseline_ids where key = 'ps_role_version'),
    'organisation',
    null
  ) is not null,
  'organisation-scoped problem solving responsibility granted to outsider'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000003","email":"ps-baseline-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_baseline_ids where key = 'organisation')),
  'outsider with PS responsibility selects organisation'
);

select ok(
  public.get_problem_solving_detail((select id from ps_baseline_ids where key = 'case')) is not null,
  'organisation-scoped problem solving responsibility reads same-site case'
);

select ok(
  public.get_problem_solving_detail((select id from ps_baseline_ids where key = 'exeter_case')) is not null,
  'organisation-scoped problem solving responsibility reads cross-site case'
);

select * from finish();
rollback;
