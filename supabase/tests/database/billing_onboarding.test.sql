begin;

select plan(22);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'founding-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'invitation-only@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

create temporary table founding_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on founding_ids to authenticated, anon;

select lives_ok(
  $$select public.prepare_founding_signup_binding('founding-owner@example.test')$$,
  'service path can prepare a founding signup binding'
);

select is(
  public.prepare_founding_signup_binding('founding-owner@example.test'),
  (
    select binding.id
    from public.founding_signup_bindings binding
    where binding.canonical_email = 'founding-owner@example.test'
  ),
  'unexpired founding signup binding is reused for the same canonical email'
);

select ok(
  public.finalise_founding_signup(
    (
      select binding.id
      from public.founding_signup_bindings binding
      where binding.canonical_email = 'founding-owner@example.test'
      order by binding.created_at desc
      limit 1
    ),
    'c1000000-0000-4000-8000-000000000001'
  ),
  'founding signup grants organisation-founding capability'
);

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', 'stranger@example.test',
        'user_metadata', '{}'::jsonb
      )
    )
  ) -> 'error' is not null,
  'signup without invitation or founding binding is still rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c2000000-0000-4000-8000-000000000002","email":"invitation-only@example.test"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.create_founding_organisation(
    'Blocked Org', 'GB', 'en-GB', 'UTC', 'GBP', 'Blocked Site', 1, 'fake'
  )$$,
  '42501',
  'organisation founding is not authorised',
  'users without founding capability cannot create organisations'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c2000000-0000-4000-8000-000000000001","email":"founding-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.current_can_found_organisation(),
  'founding owner can create an organisation'
);

select lives_ok(
  $$insert into founding_ids (key, id) values (
    'organisation',
    public.create_founding_organisation(
      'Founding Org', 'GB', 'en-GB', 'UTC', 'GBP', 'Founding Site', 2, 'fake'
    )
  )$$,
  'founding owner can provision a paid organisation'
);

select ok(
  not public.current_can_found_organisation(),
  'successful organisation creation consumes the founding capability'
);

select throws_ok(
  $$select public.create_founding_organisation(
    'Second Org', 'GB', 'en-GB', 'UTC', 'GBP', 'Second Site', 1, 'fake'
  )$$,
  '42501',
  'organisation founding is not authorised',
  'second direct create_founding_organisation is rejected after capability consumption'
);

select is(
  (
    select listed.organisation_status
    from public.list_my_eligible_organisations() listed
  ),
  'provisioning',
  'founder can list the provisioning organisation'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from founding_ids where key = 'organisation'),
    'second-site',
    'Second Site',
    'site'
  ),
  '42501',
  'unit creation is not authorised',
  'provisioning organisations cannot use operational modules'
);

select is(
  public.complete_organisation_onboarding(),
  false,
  'onboarding cannot complete while the organisation is still provisioning'
);

reset role;

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from founding_ids where key = 'organisation')
  ),
  'provisioning',
  'founding organisations start in provisioning'
);

select ok(
  (
    select organisation.onboarding_required
      and account.intended_site_quantity = 2
      and (
        select count(*) from public.organisation_units unit
        where unit.organisation_id = organisation.id
          and unit.unit_type = 'site'
      ) = 1
    from public.organisations organisation
    join public.organisation_billing_accounts account
      on account.organisation_id = organisation.id
    where organisation.id = (select id from founding_ids where key = 'organisation')
  ),
  'founding organisations record first site, onboarding, and intended quantity'
);

insert into founding_ids (key, id)
values (
  'seeded_organisation',
  private.provision_organisation(
    'c1000000-0000-4000-8000-000000000001',
    'seeded-billing-org',
    'Seeded Billing Org'
  )
);

select is(
  (
    select organisation.onboarding_required
    from public.organisations organisation
    where organisation.id = (select id from founding_ids where key = 'seeded_organisation')
  ),
  false,
  'existing provisioned organisations do not require the billing onboarding wizard'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from founding_ids where key = 'organisation'),
    'fake',
    'cus_founding',
    'sub_founding',
    'professional',
    'monthly',
    2,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    statement_timestamp()
  ),
  'applied',
  'paid snapshot can activate a founding organisation'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from founding_ids where key = 'organisation')
  ),
  'active',
  'successful checkout activates the founding organisation'
);

select is(
  (
    select organisation.onboarding_required
    from public.organisations organisation
    where organisation.id = (select id from founding_ids where key = 'organisation')
  ),
  true,
  'activation leaves the skippable onboarding wizard required'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c2000000-0000-4000-8000-000000000001","email":"founding-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.complete_organisation_onboarding(),
  'owner can complete onboarding after activation'
);

reset role;

select is(
  (
    select organisation.onboarding_required
    from public.organisations organisation
    where organisation.id = (select id from founding_ids where key = 'organisation')
  ),
  false,
  'completed onboarding clears the wizard gate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c2000000-0000-4000-8000-000000000001","email":"founding-owner@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from founding_ids where key = 'organisation'),
    'second-site',
    'Second Site',
    'site'
  ),
  'paid quantity of two allows a second site after activation'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from founding_ids where key = 'organisation'),
    'third-site',
    'Third Site',
    'site'
  ),
  'P0001',
  'site quantity is already at the paid subscription limit',
  'paid site quantity is enforced when adding sites'
);

select * from finish();

rollback;
