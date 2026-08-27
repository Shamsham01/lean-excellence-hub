begin;

select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1200000-0000-0000-0000-000000000001',
  'ps-security-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1200000-0000-0000-0000-000000000003',
  'ps-security-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_security_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_security_ids to authenticated;

insert into ps_security_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1200000-0000-0000-0000-000000000001',
    'ps-security-org',
    'Problem Solving Security Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1210000-0000-0000-0000-000000000001',
  'a1200000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1210000-0000-0000-0000-000000000003',
  'a1200000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1200000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1210000-0000-0000-0000-000000000001","email":"ps-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_security_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_security_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_security_ids where key = 'organisation'),
  null,
  'security-site',
  'Security Site',
  'site'
);

insert into ps_security_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Cross-tenant security case',
  (select id from ps_security_ids where key = 'unit_root'),
  'Leak test problem statement'
);

select ok(
  (select id from ps_security_ids where key = 'case') is not null,
  'owner creates problem solving case draft'
);

reset role;

insert into ps_security_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'a1200000-0000-0000-0000-000000000003',
    'ps-security-org-b',
    'Problem Solving Security Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1200000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1210000-0000-0000-0000-000000000003","email":"ps-security-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_security_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.get_problem_solving_detail(%L::uuid)',
    (select id from ps_security_ids where key = 'case')
  ),
  'problem solving detail is not authorised',
  '42501'
);

select ok(
  not exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.id = (select id from ps_security_ids where key = 'case')
  ),
  'cross-tenant user cannot read problem solving cases directly'
);

select throws_ok(
  format(
    'select public.update_problem_solving_case_draft(%L::uuid, %L)',
    (select id from ps_security_ids where key = 'case'),
    'Malicious rename'
  ),
  'problem solving case not found',
  'P0002'
);

select throws_ok(
  format(
    'select public.create_current_condition_item(%L::uuid, %L, %L)',
    (select id from ps_security_ids where key = 'case'),
    'observation',
    'Cross-tenant observation'
  ),
  'problem solving case not found',
  'P0002'
);

select * from finish();
rollback;
