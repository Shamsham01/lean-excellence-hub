begin;

select plan(2);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2400000-0000-4000-8000-000000000001',
  'ess-mut@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ess_mut_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on ess_mut_ids to authenticated;

insert into ess_mut_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2400000-0000-4000-8000-000000000001',
    'ess-mut-org',
    'Essentials Mutation Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from ess_mut_ids where key = 'organisation'),
  'fake', 'cus_ess_mut', 'sub_ess_mut', 'essentials', 'monthly', 1,
  'price_fake_ess_mut', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 14:05:00+00'
);

select ok(
  private.organisation_plan_capability(
    (select id from ess_mut_ids where key = 'organisation'),
    'module_training'
  ) = false,
  'essentials denies training module capability'
);

select ok(
  private.organisation_plan_capability(
    (select id from ess_mut_ids where key = 'organisation'),
    'module_suggestions'
  ),
  'essentials grants suggestions module'
);

select * from finish();
rollback;
