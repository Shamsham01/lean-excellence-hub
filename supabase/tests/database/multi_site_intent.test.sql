begin;

select plan(16);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'e01c0000-0000-4000-8000-000000000001',
    'multisite-founder-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e01c0000-0000-4000-8000-000000000002',
    'multisite-founder-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'e01c1000-0000-4000-8000-000000000001',
    'e01c0000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'e01c1000-0000-4000-8000-000000000002',
    'e01c0000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

create temporary table multi_site_intent_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on multi_site_intent_ids to authenticated, anon;

select lives_ok(
  $$select public.prepare_founding_signup_binding('multisite-founder-a@example.test')$$,
  'founder A signup binding can be prepared'
);

select ok(
  public.finalise_founding_signup(
    (
      select binding.id
      from public.founding_signup_bindings binding
      where binding.canonical_email = 'multisite-founder-a@example.test'
      order by binding.created_at desc
      limit 1
    ),
    'e01c0000-0000-4000-8000-000000000001'
  ),
  'founder A receives founding capability'
);

select lives_ok(
  $$select public.prepare_founding_signup_binding('multisite-founder-b@example.test')$$,
  'founder B signup binding can be prepared'
);

select ok(
  public.finalise_founding_signup(
    (
      select binding.id
      from public.founding_signup_bindings binding
      where binding.canonical_email = 'multisite-founder-b@example.test'
      order by binding.created_at desc
      limit 1
    ),
    'e01c0000-0000-4000-8000-000000000002'
  ),
  'founder B receives founding capability'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.set_organisation_multi_site_intent(text)',
    'execute'
  ),
  'anon cannot set multi-site intent'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e01c0000-0000-4000-8000-000000000001","role":"authenticated","session_id":"e01c1000-0000-4000-8000-000000000001","email":"multisite-founder-a@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into multi_site_intent_ids (key, id) values (
    'org_a',
    public.create_founding_organisation(
      'Acme Foods Ltd',
      'GB',
      'en-GB',
      'UTC',
      'GBP',
      'Plymouth Factory',
      1,
      'fake',
      'yes'
    )
  )$$,
  'founder A can create an organisation with multi-site intent yes'
);

reset role;

select is(
  (
    select organisation.multi_site_intent
    from public.organisations organisation
    where organisation.id = (select id from multi_site_intent_ids where key = 'org_a')
  ),
  'yes',
  'founding persists multi-site intent as product context'
);

select ok(
  (
    select count(*) = 1
    from public.organisation_units unit
    where unit.organisation_id = (select id from multi_site_intent_ids where key = 'org_a')
      and unit.unit_type = 'site'
      and unit.name = 'Plymouth Factory'
  ),
  'first site remains inside the founding organisation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e01c0000-0000-4000-8000-000000000002","role":"authenticated","session_id":"e01c1000-0000-4000-8000-000000000002","email":"multisite-founder-b@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into multi_site_intent_ids (key, id) values (
    'org_b',
    public.create_founding_organisation(
      'North Mill Ltd',
      'GB',
      'en-GB',
      'UTC',
      'GBP',
      'Manchester Mill',
      1,
      'fake'
    )
  )$$,
  'founder B can create an organisation without supplying intent'
);

reset role;

select is(
  (
    select organisation.multi_site_intent
    from public.organisations organisation
    where organisation.id = (select id from multi_site_intent_ids where key = 'org_b')
  ),
  null,
  'omitted intent stays null for backward-compatible founding callers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e01c0000-0000-4000-8000-000000000002","role":"authenticated","session_id":"e01c1000-0000-4000-8000-000000000002","email":"multisite-founder-b@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select organisation.multi_site_intent
    from public.organisations organisation
    where organisation.id = (select id from multi_site_intent_ids where key = 'org_a')
  ),
  null,
  'organisation B cannot read organisation A multi-site intent through RLS'
);

select throws_ok(
  $$select public.set_organisation_multi_site_intent('yes')$$,
  '42501',
  'multi-site intent cannot be updated',
  'provisioning organisations cannot update multi-site intent before they are operational'
);

reset role;

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from multi_site_intent_ids where key = 'org_a'),
    'fake',
    'cus_acme_foods',
    'sub_acme_foods',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    statement_timestamp()
  ),
  'applied',
  'organisation A subscription quantity 1 applies'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e01c0000-0000-4000-8000-000000000001","role":"authenticated","session_id":"e01c1000-0000-4000-8000-000000000001","email":"multisite-founder-a@example.test"}',
  true
);
set local role authenticated;

select is(
  public.set_organisation_multi_site_intent('not_sure'),
  'not_sure',
  'organisation administrator can update multi-site intent for the current organisation'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from multi_site_intent_ids where key = 'org_a'),
    'bristol-factory',
    'Bristol Factory',
    'site'
  ),
  'P0001',
  'site quantity is already at the paid subscription limit',
  'multi-site intent yes does not bypass subscribed site capacity'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from multi_site_intent_ids where key = 'org_b'),
    'hostile-site',
    'Hostile Site',
    'site'
  ),
  '42501',
  'unit creation is not authorised',
  'organisation A cannot create a site in organisation B'
);

reset role;

select * from finish();
rollback;
