begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2600000-0000-4000-8000-000000000001',
  'rpc-bypass@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2610000-0000-4000-8000-000000000001',
  'b2600000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

create temporary table bypass_ids (key text primary key, id uuid not null, unit_id uuid) on commit drop;
grant select, insert, update on bypass_ids to authenticated;

insert into bypass_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2600000-0000-4000-8000-000000000001',
    'rpc-bypass-org',
    'RPC Bypass Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from bypass_ids where key = 'organisation'),
  'fake', 'cus_bypass', 'sub_bypass', 'essentials', 'monthly', 1,
  'price_fake_bypass', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 15:00:00+00'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2600000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2610000-0000-4000-8000-000000000001","email":"rpc-bypass@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from bypass_ids where key = 'organisation')),
  'essentials owner context for RPC bypass tests'
);

update bypass_ids
set unit_id = public.create_organisation_unit(
  (select id from bypass_ids where key = 'organisation'),
  null,
  'bypass-site',
  'Bypass Site',
  'site'
)
where key = 'organisation';

select throws_ok(
  $$
    select public.create_improvement_project(
      'Bypass Project',
      (select unit_id from bypass_ids where key = 'organisation')
    );
  $$,
  '42501',
  null,
  'essentials cannot create projects via public RPC'
);

select throws_ok(
  $$
    select public.create_training_course_draft(
      'Bypass Course',
      'BPC-001'
    );
  $$,
  '42501',
  null,
  'essentials cannot create training drafts via public RPC'
);

select throws_ok(
  $$
    select public.create_skill(
      'Bypass Skill',
      'bpskill'
    );
  $$,
  '42501',
  null,
  'essentials cannot create skills via public RPC'
);

select throws_ok(
  $$
    select public.create_recognition_type(
      'Bypass Type',
      'bypass-type'
    );
  $$,
  '42501',
  null,
  'essentials cannot create recognition types via public RPC'
);

select throws_ok(
  $$
    select public.create_benefit_draft(
      'Bypass Benefit',
      (select unit_id from bypass_ids where key = 'organisation'),
      'financial',
      null,
      'cost_reduction'
    );
  $$,
  '42501',
  null,
  'essentials cannot create benefit drafts via public RPC'
);

select lives_ok(
  $$
    select public.preauthorize_workforce_provision(
      'Bypass User',
      'bypass.user',
      (
        select role_version.id
        from public.role_versions role_version
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where role_version.organisation_id = (select id from bypass_ids where key = 'organisation')
          and role_row.canonical_name = 'organisation-administrator'
          and role_version.status = 'published'
        limit 1
      ),
      'organisation'
    );
  $$,
  'essentials may preauthorize foundation workforce provisioning (not paid HR import)'
);

select lives_ok(
  $$ select public.create_job_function('Operator', 'operator') $$,
  'essentials can still create job functions (all-plan foundation)'
);

select ok(
  public.current_organisation_plan_module_entitled('suggestions'),
  'essentials retains suggestions for contrast'
);

select ok(
  not public.current_organisation_plan_module_entitled('projects'),
  'essentials plan module entitlement denies projects'
);

select * from finish();
rollback;
