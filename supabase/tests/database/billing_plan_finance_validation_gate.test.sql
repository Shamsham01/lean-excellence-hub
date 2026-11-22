begin;

select plan(5);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2100000-0000-4000-8000-000000000001',
  'plan-fin-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table plan_fin_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on plan_fin_ids to authenticated;

insert into plan_fin_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2100000-0000-4000-8000-000000000001',
    'plan-fin-essentials-org',
    'Plan Finance Essentials Organisation'
  )
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from plan_fin_ids where key = 'organisation'),
    'fake',
    'cus_plan_fin_ess',
    'sub_plan_fin_ess',
    'essentials',
    'monthly',
    1,
    'price_fake_essentials_fin',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-11-08 12:00:00+00'
  ),
  'applied',
  'essentials subscription applies'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_fin_ids where key = 'organisation'),
    'module_benefits'
  ),
  false,
  'essentials organisation lacks benefits module'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_fin_ids where key = 'organisation'),
    'module_maturity'
  ),
  true,
  'essentials organisation includes maturity module'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.record_benefit_validation(uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.record_benefit_validation directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.record_benefit_validation(uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated retains public.record_benefit_validation wrapper'
);

select * from finish();

rollback;
