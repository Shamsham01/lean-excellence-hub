begin;

select plan(37);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'billing-life-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table billing_life_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on billing_life_ids to authenticated, anon;

insert into billing_life_ids (key, id)
values (
  'organisation_a',
  private.provision_organisation(
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-a',
    'Billing Life A'
  )
);

insert into billing_life_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-b',
    'Billing Life B'
  )
);

insert into billing_life_ids (key, id)
values (
  'organisation_c',
  private.provision_organisation(
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-c',
    'Billing Life C'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
);

update public.organisations
set status = 'provisioning',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from billing_life_ids where key = 'organisation_a');

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 12:00:00+00'
  ),
  'applied',
  'first operational snapshot applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'active',
  'successful subscription activates a provisioning organisation'
);

select ok(
  exists (
    select 1
    from public.security_audit_events audit_event
    where audit_event.organisation_id = (
      select id from billing_life_ids where key = 'organisation_a'
    )
      and audit_event.action = 'organisation.activated'
  ),
  'activation writes a security audit event'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'cancel_at_period_end',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    true,
    timestamptz '2026-09-29 13:00:00+00'
  ),
  'applied',
  'scheduled cancellation snapshot applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'active',
  'cancel at period end keeps the organisation active'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'past_due',
    'past_due',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 14:00:00+00',
    statement_timestamp() + interval '7 days'
  ),
  'applied',
  'past_due snapshot with remaining grace applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'active',
  'access remains during the configured grace window'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'past_due',
    'past_due',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 15:00:00+00',
    timestamptz '2026-09-01 00:00:00+00'
  ),
  'applied',
  'past_due snapshot with expired grace applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'suspended',
  'unrecovered grace suspends the organisation'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 16:00:00+00'
  ),
  'applied',
  'paid recovery snapshot applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'active',
  'paid recovery reactivates without deleting tenant data'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_a'),
    'fake',
    'cus_life_a',
    'sub_life_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'canceled',
    'ended',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 17:00:00+00'
  ),
  'applied',
  'ended snapshot applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_a')
  ),
  'suspended',
  'ended subscription suspends the organisation'
);

select ok(
  (
    select subscription.retention_eligible_at is not null
      and organisation.status <> 'closed'
    from public.organisation_subscriptions subscription
    join public.organisations organisation
      on organisation.id = subscription.organisation_id
    where subscription.organisation_id = (
      select id from billing_life_ids where key = 'organisation_a'
    )
  ),
  'ended subscription records retention eligibility and never auto-closes'
);

update public.organisations
set status = 'provisioning',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from billing_life_ids where key = 'organisation_b');

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_b'),
    'fake',
    'cus_life_b',
    'sub_life_b',
    'essentials',
    'monthly',
    1,
    'price_fake_essentials_monthly',
    'canceled',
    'ended',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 12:00:00+00'
  ),
  'applied',
  'ended snapshot on a provisioning organisation applies'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_b')
  ),
  'provisioning',
  'provisioning plus ended stays provisioning'
);

update public.organisations
set status = 'closed',
    status_reason = 'Operator closed this tenant for the lifecycle test.',
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from billing_life_ids where key = 'organisation_c');

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_c'),
    'fake',
    'cus_life_c',
    'sub_life_c',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 12:00:00+00'
  ),
  'applied',
  'snapshot against a closed organisation still persists billing'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from billing_life_ids where key = 'organisation_c')
  ),
  'closed',
  'closed organisations are never reopened by billing snapshots'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2000000-0000-4000-8000-000000000001","email":"billing-life-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from billing_life_ids where key = 'organisation_a')),
  'owner can select a suspended organisation'
);

select ok(
  private.current_membership_id(
    (select id from billing_life_ids where key = 'organisation_a')
  ) is null,
  'operational membership stays closed while the organisation is suspended'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'suspended',
  'billing snapshot remains readable on the lifecycle membership path'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from billing_life_ids where key = 'organisation_a'),
    'life-site-1',
    'Life Site 1',
    'site'
  ),
  '42501',
  'unit creation is not authorised',
  'suspended organisations cannot use operational modules'
);

select ok(
  (
    select bool_and(listed.organisation_status in ('provisioning', 'suspended'))
      and count(*) = 2
    from public.list_my_eligible_organisations() listed
  ),
  'list includes provisioning and suspended organisations and excludes closed'
);

select ok(
  public.switch_organisation((select id from billing_life_ids where key = 'organisation_b')),
  'owner can select a provisioning organisation without blocking other tenants'
);

reset role;

insert into billing_life_ids (key, id)
values (
  'organisation_grace',
  private.provision_organisation(
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-grace',
    'Billing Life Grace'
  )
);

insert into billing_life_ids (key, id)
values (
  'organisation_legacy',
  private.provision_organisation(
    'b1000000-0000-4000-8000-000000000001',
    'billing-life-legacy',
    'Billing Life Legacy'
  )
);

update public.organisations
set status = 'provisioning',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from billing_life_ids where key = 'organisation_grace');

update public.organisations
set status = 'active',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id = (select id from billing_life_ids where key = 'organisation_legacy');

insert into private.identity_controls (
  user_id,
  status,
  enrolment_status,
  stewardship_kind,
  enrolment_completed_at
)
values (
  'b1000000-0000-4000-8000-000000000002',
  'active',
  'complete',
  'platform',
  statement_timestamp()
)
on conflict (user_id) do update
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp();

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from billing_life_ids where key = 'organisation_grace'),
  'b1000000-0000-4000-8000-000000000002',
  'active',
  statement_timestamp()
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  statement_timestamp(),
  statement_timestamp()
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_grace'),
    'fake',
    'cus_life_grace',
    'sub_life_grace',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 18:00:00+00'
  ),
  'applied',
  'grace organisation activates from a paid snapshot'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_life_ids where key = 'organisation_grace'),
    'fake',
    'cus_life_grace',
    'sub_life_grace',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'past_due',
    'past_due',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 19:00:00+00',
    statement_timestamp() + interval '7 days'
  ),
  'applied',
  'payment failure starts the grace window without a later webhook'
);

alter table public.organisation_subscriptions
  disable trigger organisation_subscriptions_lifecycle_trigger;

update public.organisation_subscriptions
set grace_expires_at = statement_timestamp() - interval '1 hour'
where organisation_id = (
  select id from billing_life_ids where key = 'organisation_grace'
);

alter table public.organisation_subscriptions
  enable trigger organisation_subscriptions_lifecycle_trigger;

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (
      select id from billing_life_ids where key = 'organisation_grace'
    )
  ),
  'active',
  'expired grace without a webhook leaves stored organisation status stale-active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2000000-0000-4000-8000-000000000001","email":"billing-life-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from billing_life_ids where key = 'organisation_grace')
  ),
  'owner can still select the stale-active organisation for billing recovery'
);

select ok(
  private.current_membership_id(
    (select id from billing_life_ids where key = 'organisation_grace')
  ) is null,
  'expired grace denies operational membership without a later billing webhook'
);

select is(
  (
    select listed.organisation_status
    from public.list_my_eligible_organisations() listed
    where listed.organisation_id = (
      select id from billing_life_ids where key = 'organisation_grace'
    )
  ),
  'suspended',
  'list treats expired-grace organisations as suspended so callers route to /billing'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from billing_life_ids where key = 'organisation_grace'),
    'grace-site-1',
    'Grace Site 1',
    'site'
  ),
  '42501',
  'unit creation is not authorised',
  'stale-active expired grace cannot continue operational DB paths'
);

select ok(
  public.current_can_manage_billing(),
  'billing-authorised owner retains Customer Portal authority after grace expiry'
);

select ok(
  not public.has_scoped_permission(
    (select id from billing_life_ids where key = 'organisation_grace'),
    'billing.manage'
  ),
  'operational has_scoped_permission stays closed during stale-active expired grace'
);

select ok(
  public.switch_organisation(
    (select id from billing_life_ids where key = 'organisation_legacy')
  ),
  'owner can select a legacy organisation with no subscription'
);

select ok(
  private.current_membership_id(
    (select id from billing_life_ids where key = 'organisation_legacy')
  ) is not null,
  'legacy organisations without a subscription keep operational membership'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b2000000-0000-4000-8000-000000000002","email":"billing-life-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from billing_life_ids where key = 'organisation_grace')
  ),
  'ordinary member can select the suspended organisation'
);

select ok(
  not public.current_can_manage_billing(),
  'ordinary suspended members cannot open Customer Portal'
);

select * from finish();

rollback;
