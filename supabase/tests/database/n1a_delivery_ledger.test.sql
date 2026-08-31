begin;

select plan(27);

create temporary table n1a_delivery_ids (
  key text primary key,
  id uuid,
  token uuid
) on commit drop;

grant select, insert, update on n1a_delivery_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'n1a-delivery-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'n1a-delivery-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'n1a-delivery-member-a2@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into n1a_delivery_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'd1000000-0000-0000-0000-000000000001',
      'n1a-delivery-org-a',
      'N1a Delivery Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'd1000000-0000-0000-0000-000000000002',
      'n1a-delivery-org-b',
      'N1a Delivery Org B'
    )
  );

insert into n1a_delivery_ids (key, id)
select
  'membership_a',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1a_delivery_ids where key = 'org_a')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000001';

insert into n1a_delivery_ids (key, id)
select
  'membership_b',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1a_delivery_ids where key = 'org_b')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000002';

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values (
  (select id from n1a_delivery_ids where key = 'org_a'),
  'd1000000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
);

insert into n1a_delivery_ids (key, id)
select
  'membership_a2',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1a_delivery_ids where key = 'org_a')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000003';

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, id)
select
  'event_a',
  private.enqueue_domain_event(
    (select id from n1a_delivery_ids where key = 'org_a'),
    null,
    'DeliverySourceEvent',
    'n1a-delivery-source-event',
    '{}'::jsonb
  );

insert into n1a_delivery_ids (key, id)
select
  'event_a2',
  private.enqueue_domain_event(
    (select id from n1a_delivery_ids where key = 'org_a'),
    null,
    'DeliverySourceEvent2',
    'n1a-delivery-source-event-2',
    '{}'::jsonb
  );

insert into n1a_delivery_ids (key, id)
select
  'event_b',
  private.enqueue_domain_event(
    (select id from n1a_delivery_ids where key = 'org_b'),
    null,
    'DeliverySourceEventB',
    'n1a-delivery-source-event-b',
    '{}'::jsonb
  );

select ok(
  to_regclass('private.notification_delivery_ledger') is not null,
  'A: notification_delivery_ledger table exists'
);

select ok(
  not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'private'
      and column_row.table_name = 'notification_delivery_ledger'
      and column_row.column_name in ('recipient_email', 'rendered_html', 'rendered_text')
  ),
  'B: delivery ledger has no email or rendered content columns'
);

insert into n1a_delivery_ids (key, id)
select
  'delivery',
  private.create_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'event_a'),
    (select id from n1a_delivery_ids where key = 'membership_a'),
    'workforce.welcome',
    'n1a-delivery-key-001'
  );

select is(
  private.create_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'event_a'),
    (select id from n1a_delivery_ids where key = 'membership_a'),
    'workforce.welcome',
    'n1a-delivery-key-001'
  ),
  (select id from n1a_delivery_ids where key = 'delivery'),
  'C: duplicate delivery_key returns existing row idempotently'
);

select throws_ok(
  $$
    select private.create_notification_delivery(
      (select id from n1a_delivery_ids where key = 'org_a'),
      (select id from n1a_delivery_ids where key = 'event_a'),
      (select id from n1a_delivery_ids where key = 'membership_a2'),
      'workforce.welcome',
      'n1a-delivery-key-001'
    )
  $$,
  '23505',
  'delivery_key already exists with different immutable identity',
  'C2: same delivery_key with different recipient is rejected'
);

select throws_ok(
  $$
    select private.create_notification_delivery(
      (select id from n1a_delivery_ids where key = 'org_a'),
      (select id from n1a_delivery_ids where key = 'event_a2'),
      (select id from n1a_delivery_ids where key = 'membership_a'),
      'workforce.welcome',
      'n1a-delivery-key-001'
    )
  $$,
  '23505',
  'delivery_key already exists with different immutable identity',
  'C3: same delivery_key with different source event is rejected'
);

select throws_ok(
  $$
    select private.create_notification_delivery(
      (select id from n1a_delivery_ids where key = 'org_a'),
      (select id from n1a_delivery_ids where key = 'event_a'),
      (select id from n1a_delivery_ids where key = 'membership_a'),
      'workforce.reminder',
      'n1a-delivery-key-001'
    )
  $$,
  '23505',
  'delivery_key already exists with different immutable identity',
  'C4: same delivery_key with different notification_kind is rejected'
);

select ok(
  private.create_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_b'),
    (select id from n1a_delivery_ids where key = 'event_b'),
    (select id from n1a_delivery_ids where key = 'membership_b'),
    'workforce.welcome',
    'n1a-delivery-key-001'
  ) is not null,
  'C5: same delivery_key in another organisation remains independent'
);

select throws_ok(
  $$
    select private.create_notification_delivery(
      (select id from n1a_delivery_ids where key = 'org_a'),
      (select id from n1a_delivery_ids where key = 'event_a'),
      (select id from n1a_delivery_ids where key = 'membership_b'),
      'workforce.welcome',
      'n1a-delivery-cross-tenant'
    )
  $$,
  '23514',
  'recipient membership organisation mismatch',
  'D: cross-tenant recipient membership is blocked'
);

select throws_ok(
  $$
    select private.create_notification_delivery(
      (select id from n1a_delivery_ids where key = 'org_b'),
      (select id from n1a_delivery_ids where key = 'event_a'),
      (select id from n1a_delivery_ids where key = 'membership_b'),
      'workforce.welcome',
      'n1a-delivery-event-org-mismatch'
    )
  $$,
  '23514',
  'source domain event organisation mismatch',
  'E: source event organisation mismatch is blocked'
);

set local role service_role;

select is(
  (
    select count(*)::integer
    from private.claim_notification_deliveries(10) claimed
    where claimed.organisation_id = (select id from n1a_delivery_ids where key = 'org_a')
  ),
  1,
  'F: pending delivery is claimable'
);

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, token)
select
  'delivery_token',
  ledger_row.lease_token
from private.notification_delivery_ledger ledger_row
where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery');

select is(
  (
    select ledger_row.status
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery')
  ),
  'processing',
  'G: claim moves delivery to processing'
);

select is(
  (
    select ledger_row.attempt_count
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery')
  ),
  1,
  'H: claim increments delivery attempt_count'
);

set local role service_role;

select ok(
  not private.complete_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'delivery'),
    gen_random_uuid(),
    'provider-msg-stale'
  ),
  'I: stale lease_token is rejected on delivery complete'
);

select ok(
  private.complete_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'delivery'),
    (select token from n1a_delivery_ids where key = 'delivery_token'),
    'provider-msg-001'
  ),
  'J: valid lease_token completes delivery'
);

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery')
      and ledger_row.status = 'sent'
      and ledger_row.sent_at is not null
      and ledger_row.provider_message_id = 'provider-msg-001'
      and ledger_row.lease_token is null
  ),
  'K: sent delivery records provider_message_id and sent_at'
);

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, id)
select
  'retry_delivery',
  private.create_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'event_a'),
    (select id from n1a_delivery_ids where key = 'membership_a'),
    'workforce.retry',
    'n1a-delivery-retry'
  );

set local role service_role;

select ok((select count(*) = 1 from private.claim_notification_deliveries(1)), 'L: retry delivery claimed');

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, token)
select 'retry_token', ledger_row.lease_token
from private.notification_delivery_ledger ledger_row
where ledger_row.id = (select id from n1a_delivery_ids where key = 'retry_delivery');

set local role service_role;

select ok(
  private.fail_notification_delivery_retryable(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'retry_delivery'),
    (select token from n1a_delivery_ids where key = 'retry_token'),
    'provider_timeout'
  ),
  'M: retryable delivery failure accepted'
);

set local role lean_hub_private_owner;

select is(
  (
    select ledger_row.status
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'retry_delivery')
  ),
  'pending',
  'N: retryable delivery failure returns to pending'
);

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, id)
select
  'terminal_delivery',
  private.create_notification_delivery(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'event_a'),
    (select id from n1a_delivery_ids where key = 'membership_a'),
    'workforce.terminal',
    'n1a-delivery-terminal'
  );

update private.notification_delivery_ledger
set attempt_count = 4
where id = (select id from n1a_delivery_ids where key = 'terminal_delivery');

set local role service_role;

select ok((select count(*) = 1 from private.claim_notification_deliveries(1)), 'O: terminal candidate claimed');

set local role lean_hub_private_owner;

insert into n1a_delivery_ids (key, token)
select 'terminal_token', ledger_row.lease_token
from private.notification_delivery_ledger ledger_row
where ledger_row.id = (select id from n1a_delivery_ids where key = 'terminal_delivery');

set local role service_role;

select ok(
  private.fail_notification_delivery_retryable(
    (select id from n1a_delivery_ids where key = 'org_a'),
    (select id from n1a_delivery_ids where key = 'terminal_delivery'),
    (select token from n1a_delivery_ids where key = 'terminal_token'),
    'provider_hard_fail'
  ),
  'P: retryable failure escalates delivery at max attempts'
);

set local role lean_hub_private_owner;

select is(
  (
    select ledger_row.status
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'terminal_delivery')
  ),
  'needs_remediation',
  'Q: max attempts produce needs_remediation terminal state'
);

set local role lean_hub_private_owner;

insert into private.notification_delivery_ledger (
  organisation_id,
  source_domain_event_id,
  recipient_membership_id,
  notification_kind,
  delivery_key,
  status,
  available_at,
  processing_started_at,
  lease_expires_at,
  lease_token,
  attempt_count
)
values (
  (select id from n1a_delivery_ids where key = 'org_a'),
  (select id from n1a_delivery_ids where key = 'event_a'),
  (select id from n1a_delivery_ids where key = 'membership_a'),
  'workforce.expired',
  'n1a-delivery-expired-lease',
  'processing',
  statement_timestamp(),
  statement_timestamp() - interval '10 minutes',
  statement_timestamp() - interval '1 minute',
  gen_random_uuid(),
  1
);

set local role service_role;

select ok(
  (select count(*) = 1 from private.claim_notification_deliveries(1)),
  'R: expired delivery lease is reclaimed'
);

set local role lean_hub_private_owner;

select is(
  (
    select ledger_row.status
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery')
  ),
  'sent',
  'S: sent deliveries are not reclaimable'
);

select is(
  (
    select ledger_row.status
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'terminal_delivery')
  ),
  'needs_remediation',
  'T: needs_remediation deliveries are not reclaimable'
);

select ok(
  exists (
    select 1
    from private.notification_delivery_ledger ledger_row
    where ledger_row.id = (select id from n1a_delivery_ids where key = 'delivery')
      and ledger_row.source_domain_event_id = (select id from n1a_delivery_ids where key = 'event_a')
  ),
  'U: delivery retains auditable source event linkage'
);

reset role;

set local role authenticated;

select throws_ok(
  'select * from private.notification_delivery_ledger',
  '42501',
  null,
  'V: authenticated cannot read delivery ledger'
);

select throws_ok(
  'select private.claim_notification_deliveries(1)',
  '42501',
  null,
  'W: authenticated cannot claim deliveries'
);

reset role;

select * from finish();
rollback;
