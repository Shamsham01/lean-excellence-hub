begin;

select plan(34);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd3000000-0000-4000-8000-0000000000aa',
    'platform-operator@leh.example',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd3000000-0000-4000-8000-0000000000a1',
    'owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd3000000-0000-4000-8000-0000000000b1',
    'owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd3000000-0000-4000-8000-0000000000f1',
    'founder.confirmed@harbourfieldfoods.co.uk',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into private.platform_admins (auth_user_id, label, bootstrap_note)
values (
  'd3000000-0000-4000-8000-0000000000aa',
  'Platform operator',
  'pgTAP fixture'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.platform_admin_overview(uuid, text, text)',
    'execute'
  ),
  false,
  'authenticated cannot execute the platform overview'
);

select is(
  has_function_privilege(
    'anon',
    'public.platform_admin_overview(uuid, text, text)',
    'execute'
  ),
  false,
  'anon cannot execute the platform overview'
);

select ok(
  not exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and (
        proc.proname like 'platform\_%' escape '\'
        or proc.proname like '%platform_notification%'
        or proc.proname = 'record_platform_stripe_mode'
      )
      and has_function_privilege('authenticated', proc.oid, 'execute')
  ),
  'no platform-admin function is executable by authenticated callers'
);

select throws_ok(
  $$select public.platform_admin_overview(
    'd3000000-0000-4000-8000-0000000000a1',
    'aal2',
    '/org_admin'
  )$$,
  '42501',
  'platform admin access is not authorised',
  'organisation owner uuid is not a platform admin'
);

select throws_ok(
  $$select public.platform_admin_overview(
    'd3000000-0000-4000-8000-0000000000aa',
    'aal1',
    '/org_admin'
  )$$,
  '42501',
  'platform admin access is not authorised',
  'platform admin without aal2 cannot read the overview'
);

set local role authenticated;

select throws_ok(
  $$select public.platform_admin_overview(
    'd3000000-0000-4000-8000-0000000000aa',
    'aal2',
    '/org_admin'
  )$$,
  '42501',
  null,
  'authenticated role cannot call the overview RPC'
);

select throws_ok(
  $$select * from private.platform_admins$$,
  '42501',
  null,
  'authenticated role cannot read the platform admin allowlist'
);

reset role;

select is(
  public.platform_admin_identity_active('d3000000-0000-4000-8000-0000000000aa'),
  true,
  'active allowlist identity is recognised'
);

select is(
  public.platform_admin_identity_active('d3000000-0000-4000-8000-0000000000a1'),
  false,
  'organisation owner is not a platform admin'
);

create temporary table platform_org_ids (
  key text primary key,
  id uuid not null
) on commit drop;

insert into platform_org_ids (key, id)
values
  (
    'paying',
    private.provision_organisation(
      'd3000000-0000-4000-8000-0000000000a1',
      'platform-paying',
      'Harbourfield Foods'
    )
  ),
  (
    'provisional',
    private.provision_organisation(
      'd3000000-0000-4000-8000-0000000000b1',
      'platform-provisional',
      'Amaro Provisional'
    )
  );

update public.organisations
set status = 'provisioning'
where id in (select id from platform_org_ids);

select is(
  (
    select count(*)
    from private.platform_notification_events event
    where event.event_kind = 'organisation.founded'
      and event.organisation_id in (select id from platform_org_ids)
      and event.status = 'suppressed'
      and event.suppressed_reason = 'synthetic_identity'
  ),
  2::bigint,
  'synthetic founder addresses suppress organisation-founded alerts'
);

update public.organisations
set status = 'active'
where id = (select id from platform_org_ids where key = 'paying');

update public.organisations
set status = 'provisioning'
where id = (select id from platform_org_ids where key = 'paying');

select is(
  (
    select count(*)
    from private.platform_notification_events event
    where event.idempotency_key = 'organisation.founded:' || (
      select id::text from platform_org_ids where key = 'paying'
    )
  ),
  1::bigint,
  'returning an organisation to provisioning does not duplicate the alert'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from platform_org_ids where key = 'paying'),
    'stripe',
    'cus_platform_paying',
    'sub_platform_paying',
    'professional',
    'annual',
    3,
    'price_professional_annual',
    'active',
    'active',
    timestamptz '2026-10-01 00:00:00+00',
    timestamptz '2027-10-01 00:00:00+00',
    false,
    timestamptz '2026-10-31 12:00:00+00'
  ),
  'applied',
  'verified stripe snapshot applies'
);

select public.record_platform_stripe_mode(
  (select id from platform_org_ids where key = 'paying'),
  false,
  'evt_platform_paying_1'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from platform_org_ids where key = 'paying'),
    'stripe',
    'cus_platform_paying',
    'sub_platform_paying',
    'professional',
    'annual',
    3,
    'price_professional_annual',
    'active',
    'active',
    timestamptz '2026-10-01 00:00:00+00',
    timestamptz '2027-10-01 00:00:00+00',
    false,
    timestamptz '2026-10-31 12:05:00+00'
  ),
  'applied',
  'replayed stripe snapshot applies without a second entitlement'
);

select is(
  (
    select count(*)
    from private.platform_notification_events event
    where event.event_kind = 'subscription.entitlement_activated'
      and event.organisation_id = (select id from platform_org_ids where key = 'paying')
  ),
  1::bigint,
  'webhook replay does not duplicate the entitlement notification'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from platform_org_ids where key = 'provisional'),
    'fake',
    'cus_platform_fake',
    'sub_platform_fake',
    'professional',
    'monthly',
    1,
    'price_fake',
    'active',
    'active',
    timestamptz '2026-10-01 00:00:00+00',
    timestamptz '2026-11-01 00:00:00+00',
    false,
    timestamptz '2026-10-31 12:00:00+00'
  ),
  'applied',
  'fake billing fixture applies'
);

select is(
  (
    select count(*)
    from private.platform_notification_events event
    where event.event_kind = 'subscription.entitlement_activated'
      and event.organisation_id = (
        select id from platform_org_ids where key = 'provisional'
      )
  ),
  0::bigint,
  'fake provider activation does not enqueue an entitlement alert'
);

select ok(
  public.prepare_founding_signup_binding(
    'founder.confirmed@harbourfieldfoods.co.uk'
  ) is not null,
  'real founder binding can be prepared'
);

select ok(
  public.finalise_founding_signup(
    (
      select binding.id
      from public.founding_signup_bindings binding
      where binding.canonical_email = 'founder.confirmed@harbourfieldfoods.co.uk'
    ),
    'd3000000-0000-4000-8000-0000000000f1'
  ),
  'confirmed founder finalises'
);

select is(
  (
    select count(*)
    from private.platform_notification_events event
    where event.idempotency_key = 'founder.email_confirmed:d3000000-0000-4000-8000-0000000000f1'
      and event.status = 'pending'
  ),
  1::bigint,
  'confirmed non-synthetic founder enqueues one alert'
);

select ok(
  public.prepare_founding_signup_binding('owner-a@example.test') is not null,
  'synthetic founder binding can be prepared'
);

select ok(
  public.finalise_founding_signup(
    (
      select binding.id
      from public.founding_signup_bindings binding
      where binding.canonical_email = 'owner-a@example.test'
      order by binding.created_at desc
      limit 1
    ),
    'd3000000-0000-4000-8000-0000000000a1'
  ),
  'synthetic founder finalises'
);

select is(
  (
    select event.status
    from private.platform_notification_events event
    where event.idempotency_key = 'founder.email_confirmed:d3000000-0000-4000-8000-0000000000a1'
  ),
  'suppressed',
  'synthetic founder confirmation is suppressed'
);

select is(
  (
    public.platform_admin_organisation_detail(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations/paying',
      (select id from platform_org_ids where key = 'paying')
    ) -> 'access' ->> 'verified_customer'
  ),
  'true',
  'stripe entitlement is a verified customer'
);

select is(
  (
    public.platform_admin_organisation_detail(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations/provisional',
      (select id from platform_org_ids where key = 'provisional')
    ) -> 'access' ->> 'verified_customer'
  ),
  'false',
  'fake billing fixture is not a verified customer'
);

select is(
  (
    public.platform_admin_organisation_directory(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations',
      'Harbourfield',
      'all',
      1,
      0
    ) ->> 'total'
  )::integer,
  1,
  'directory search returns the matching organisation'
);

select is(
  (
    public.platform_admin_organisation_directory(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations',
      'platform-p',
      'all',
      1,
      0
    ) ->> 'total'
  )::integer,
  2,
  'directory total counts both fixture organisations'
);

select is(
  jsonb_array_length(
    public.platform_admin_organisation_directory(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations',
      'platform-p',
      'all',
      1,
      1
    ) -> 'rows'
  ),
  1,
  'directory page size and offset are enforced'
);

select is(
  (
    public.platform_admin_organisation_detail(
      'd3000000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin/organisations/paying',
      (select id from platform_org_ids where key = 'paying')
    ) -> 'billing' ->> 'stripe_livemode'
  ),
  'false',
  'organisation drill-down shows observed stripe test mode'
);

select ok(
  exists (
    select 1
    from private.platform_admin_access_events access_event
    where access_event.actor_user_id = 'd3000000-0000-4000-8000-0000000000aa'
      and access_event.outcome = 'allowed'
      and access_event.action = 'organisation.read'
  ),
  'organisation reads are audited'
);

select throws_ok(
  $$update private.platform_admin_access_events
    set outcome = 'denied'
    where actor_user_id = 'd3000000-0000-4000-8000-0000000000aa'$$,
  '55000',
  null,
  'platform admin access audit is append-only'
);

select is(
  public.consume_platform_admin_rate_limit(
    repeat('a', 32),
    1,
    300,
    900
  ),
  true,
  'first platform admin request is inside the rate limit'
);

select is(
  public.consume_platform_admin_rate_limit(
    repeat('a', 32),
    1,
    300,
    900
  ),
  false,
  'the next request on the same key is limited'
);

select is(
  (
    select count(*)
    from public.claim_platform_notifications_for_worker(10, 60)
  ),
  0::bigint,
  'delivery stays queued until an operator enables it'
);

update private.platform_notification_settings
set delivery_enabled = true
where singleton;

select ok(
  (
    select count(*)
    from public.claim_platform_notifications_for_worker(10, 60)
  ) >= 1,
  'enabled delivery claims pending operator notifications'
);

select * from finish();

rollback;
