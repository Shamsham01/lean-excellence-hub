begin;

select plan(19);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'plan-cap-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'plan-cap-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table plan_cap_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on plan_cap_ids to authenticated, anon;

insert into plan_cap_ids (key, id)
values (
  'organisation_a',
  private.provision_organisation(
    'b2000000-0000-4000-8000-000000000001',
    'plan-cap-a',
    'Plan Cap A'
  )
);

insert into plan_cap_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'b2000000-0000-4000-8000-000000000002',
    'plan-cap-b',
    'Plan Cap B'
  )
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'advanced_analytics'
  ),
  true,
  'legacy organisation without subscription keeps Professional capabilities'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'fake',
    'cus_plan_a',
    'sub_plan_a',
    'essentials',
    'monthly',
    1,
    'price_fake_essentials_monthly',
    'trialing',
    'trialing',
    statement_timestamp(),
    statement_timestamp() + interval '14 days',
    false,
    timestamptz '2026-11-08 12:00:00+00'
  ),
  'applied',
  'essentials trialing snapshot applies'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'advanced_analytics'
  ),
  true,
  'essentials includes analytics for entitled modules'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'advanced_benefits_governance'
  ),
  true,
  'essentials retains in-module benefits governance within entitled modules'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'module_benefits'
  ),
  false,
  'essentials denies benefits module'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'module_maturity'
  ),
  true,
  'essentials grants maturity module'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_b'),
    'module_benefits'
  ),
  true,
  'professional grants benefits module'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from plan_cap_ids where key = 'organisation_b'),
    'fake',
    'cus_plan_b',
    'sub_plan_b',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-11-08 12:05:00+00'
  ),
  'applied',
  'professional snapshot applies to tenant b'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_b'),
    'advanced_analytics'
  ),
  true,
  'professional grants advanced analytics'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_a'),
    'module_benefits'
  ),
  false,
  'tenant a remains essentials after tenant b subscribes'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_b'),
    'api_access'
  ),
  false,
  'professional plan keeps api_access off until product ships'
);

select is(
  private.organisation_plan_capability(
    (select id from plan_cap_ids where key = 'organisation_b'),
    'integrations'
  ),
  false,
  'professional plan keeps integrations off until product ships'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.plan_code_grants_capability(text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.plan_code_grants_capability'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.plan_code_grants_capability(text,text)',
    'EXECUTE'
  ),
  'anon cannot execute private.plan_code_grants_capability'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.organisation_plan_capability(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.organisation_plan_capability'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.organisation_plan_capability(uuid,text)',
    'EXECUTE'
  ),
  'anon cannot execute private.organisation_plan_capability'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.current_organisation_plan_capability(text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.current_organisation_plan_capability'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.current_organisation_plan_capability(text)',
    'EXECUTE'
  ),
  'anon cannot execute private.current_organisation_plan_capability'
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
