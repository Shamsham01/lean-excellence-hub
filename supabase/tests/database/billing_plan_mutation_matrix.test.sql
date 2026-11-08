-- Essentials plan gate matrix: one throw per Professional module family (Postgres is source of truth).
begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2700000-0000-4000-8000-000000000001',
  'matrix@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2710000-0000-4000-8000-000000000001',
  'b2700000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

create temporary table matrix_ids (key text primary key, id uuid not null, unit_id uuid) on commit drop;
grant select, insert, update on matrix_ids to authenticated;

insert into matrix_ids (key, id)
values (
  'org',
  private.provision_organisation(
    'b2700000-0000-4000-8000-000000000001',
    'matrix-org',
    'Matrix Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from matrix_ids where key = 'org'),
  'fake', 'cus_matrix', 'sub_matrix', 'essentials', 'monthly', 1,
  'price_matrix', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 16:00:00+00'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2700000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2710000-0000-4000-8000-000000000001","email":"matrix@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from matrix_ids where key = 'org')),
  'essentials owner for mutation matrix'
);

update matrix_ids
set unit_id = public.create_organisation_unit(
  (select id from matrix_ids where key = 'org'),
  null,
  'matrix-site',
  'Matrix Site',
  'site'
)
where key = 'org';

select throws_ok(
  $$ select public.create_improvement_project('M', (select unit_id from matrix_ids where key = 'org')) $$,
  '42501', null, 'projects'
);
select throws_ok(
  $$ select public.create_benefit_draft('M', (select unit_id from matrix_ids where key = 'org'), 'financial', null, 'cost_reduction') $$,
  '42501', null, 'benefits'
);
select throws_ok(
  $$ select public.create_problem_solving_case_draft('M', (select unit_id from matrix_ids where key = 'org')) $$,
  '42501', null, 'problem_solving'
);
select throws_ok(
  $$ select public.create_training_course_draft('M', 'm-001') $$,
  '42501', null, 'training'
);
select throws_ok(
  $$ select public.create_skill('M', 'm-skill') $$,
  '42501', null, 'skills'
);
select throws_ok(
  $$ select public.create_recognition_type('M', 'm-type') $$,
  '42501', null, 'recognition'
);
select throws_ok(
  $$ select public.create_workforce_import_job('matrix.csv') $$,
  '42501', null, 'people_hr workforce import'
);

select * from finish();
rollback;
