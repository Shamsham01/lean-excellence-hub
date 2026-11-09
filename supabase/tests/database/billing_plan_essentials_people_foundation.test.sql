begin;

select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2300000-0000-4000-8000-000000000001',
  'ess-people@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2310000-0000-4000-8000-000000000001',
  'b2300000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

create temporary table ess_people_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ess_people_ids to authenticated;

insert into ess_people_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2300000-0000-4000-8000-000000000001',
    'ess-people-org',
    'Essentials People Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from ess_people_ids where key = 'organisation'),
  'fake',
  'cus_ess_people',
  'sub_ess_people',
  'essentials',
  'monthly',
  1,
  'price_fake_ess_people',
  'active',
  'active',
  statement_timestamp(),
  statement_timestamp() + interval '30 days',
  false,
  timestamptz '2026-11-08 14:00:00+00'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.issue_organisation_member_invitation_grants(text,text,bytea,timestamptz,jsonb,text,uuid,uuid)',
    'EXECUTE'
  ),
  'essentials retains invitation grant RPC execute privilege'
);

select is(
  private.organisation_plan_capability(
    (select id from ess_people_ids where key = 'organisation'),
    'module_projects'
  ),
  false,
  'essentials lacks projects module'
);

select is(
  private.organisation_plan_capability(
    (select id from ess_people_ids where key = 'organisation'),
    'module_people_hr'
  ),
  false,
  'essentials lacks paid people HR module'
);

select is(
  private.organisation_plan_capability(
    (select id from ess_people_ids where key = 'organisation'),
    'module_maturity'
  ),
  true,
  'essentials keeps maturity module'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2300000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2310000-0000-4000-8000-000000000001"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from ess_people_ids where key = 'organisation')),
  'essentials owner selects organisation'
);

select lives_ok(
  $$
    select public.preauthorize_workforce_provision(
      'Frontline Operator',
      'frontline.operator',
      (
        select role_version.id
        from public.role_versions role_version
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where role_version.organisation_id = (select id from ess_people_ids where key = 'organisation')
          and role_row.canonical_name = 'organisation-administrator'
          and role_version.status = 'published'
        limit 1
      ),
      'organisation'
    );
  $$,
  'essentials foundations: workforce preauthorize is not people_hr gated'
);

select lives_ok(
  $$
    select public.create_workforce_import_job('essentials-import.csv')
  $$,
  'essentials foundations: workforce CSV import job is not people_hr gated'
);

select * from finish();
rollback;
