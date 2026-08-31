begin;

select plan(28);

create temporary table n1a_outbox_ids (
  key text primary key,
  id uuid,
  token uuid
) on commit drop;

grant select, insert, update on n1a_outbox_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'n1a-outbox-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into n1a_outbox_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1000000-0000-0000-0000-000000000001',
    'n1a-outbox-org',
    'N1a Outbox Org'
  )
);

select ok(
  to_regclass('private.domain_event_outbox') is not null,
  'A: domain_event_outbox table exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'private'
      and column_row.table_name = 'domain_event_outbox'
      and column_row.column_name = 'lease_token'
  ),
  'B: lease_token column exists'
);

set local role lean_hub_private_owner;

select is(
  private.enqueue_domain_event(
    (select id from n1a_outbox_ids where key = 'organisation'),
    null,
    'N1aTestEvent',
    'n1a-outbox-idempotency-key',
    '{"sample":true}'::jsonb
  ),
  private.enqueue_domain_event(
    (select id from n1a_outbox_ids where key = 'organisation'),
    null,
    'N1aTestEvent',
    'n1a-outbox-idempotency-key',
    '{"sample":true}'::jsonb
  ),
  'C: enqueue_domain_event remains idempotent for producers'
);

insert into n1a_outbox_ids (key, id)
select
  'event',
  outbox_row.id
from private.domain_event_outbox outbox_row
where outbox_row.organisation_id = (select id from n1a_outbox_ids where key = 'organisation')
  and outbox_row.idempotency_key = 'n1a-outbox-idempotency-key';

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
  ),
  'pending',
  'D: freshly enqueued event is pending with safe defaults'
);

select is(
  (
    select outbox_row.attempt_count
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
  ),
  0,
  'E: attempt_count defaults to zero'
);

update private.domain_event_outbox
set available_at = statement_timestamp() + interval '1 hour'
where id = (select id from n1a_outbox_ids where key = 'event');

set local role service_role;

select is(
  (select count(*)::integer from private.claim_domain_events(10)),
  0,
  'F: future available_at prevents claim'
);

update private.domain_event_outbox
set available_at = statement_timestamp()
where id = (select id from n1a_outbox_ids where key = 'event');

select is(
  (select count(*)::integer from private.claim_domain_events(10)),
  1,
  'G: eligible pending event is claimed'
);

insert into n1a_outbox_ids (key, token)
select
  'claim_token',
  outbox_row.lease_token
from private.domain_event_outbox outbox_row
where outbox_row.id = (select id from n1a_outbox_ids where key = 'event');

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
  ),
  'processing',
  'H: claim moves event to processing lease'
);

select is(
  (
    select outbox_row.attempt_count
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
  ),
  1,
  'I: claim increments attempt_count once'
);

select ok(
  outbox_row.lease_token is not null
  and outbox_row.lease_expires_at > statement_timestamp(),
  'J: claim assigns lease_token and lease_expires_at'
)
from private.domain_event_outbox outbox_row
where outbox_row.id = (select id from n1a_outbox_ids where key = 'event');

select ok(
  not private.complete_domain_event(
    (select id from n1a_outbox_ids where key = 'organisation'),
    (select id from n1a_outbox_ids where key = 'event'),
    gen_random_uuid()
  ),
  'K: stale lease_token is rejected on complete'
);

select ok(
  private.complete_domain_event(
    (select id from n1a_outbox_ids where key = 'organisation'),
    (select id from n1a_outbox_ids where key = 'event'),
    (select token from n1a_outbox_ids where key = 'claim_token')
  ),
  'L: valid lease_token completes event'
);

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
  ),
  'processed',
  'M: completed event is processed'
);

select ok(
  exists (
    select 1
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'event')
      and outbox_row.processed_at is not null
      and outbox_row.lease_token is null
  ),
  'N: processed event clears lease fields and sets processed_at'
);

insert into private.domain_event_outbox (
  organisation_id,
  event_type,
  payload,
  idempotency_key,
  processing_state,
  available_at
)
values (
  (select id from n1a_outbox_ids where key = 'organisation'),
  'RetryableEvent',
  '{}'::jsonb,
  'n1a-retryable-event',
  'pending',
  statement_timestamp()
);

insert into n1a_outbox_ids (key, id)
select 'retry_event', outbox_row.id
from private.domain_event_outbox outbox_row
where outbox_row.idempotency_key = 'n1a-retryable-event';

select ok(
  (select count(*) = 1 from private.claim_domain_events(1)),
  'O: retryable event can be claimed'
);

insert into n1a_outbox_ids (key, token)
select 'retry_token', outbox_row.lease_token
from private.domain_event_outbox outbox_row
where outbox_row.id = (select id from n1a_outbox_ids where key = 'retry_event');

select ok(
  private.fail_domain_event_retryable(
    (select id from n1a_outbox_ids where key = 'organisation'),
    (select id from n1a_outbox_ids where key = 'retry_event'),
    (select token from n1a_outbox_ids where key = 'retry_token'),
    'transient_error',
    'safe detail'
  ),
  'P: retryable failure is accepted'
);

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'retry_event')
  ),
  'pending',
  'Q: retryable failure returns event to pending'
);

select ok(
  (
    select outbox_row.available_at
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'retry_event')
  ) > statement_timestamp(),
  'R: retryable failure schedules future available_at'
);

insert into private.domain_event_outbox (
  organisation_id,
  event_type,
  payload,
  idempotency_key,
  processing_state,
  available_at,
  attempt_count
)
values (
  (select id from n1a_outbox_ids where key = 'organisation'),
  'TerminalEvent',
  '{}'::jsonb,
  'n1a-terminal-event',
  'pending',
  statement_timestamp(),
  4
);

insert into n1a_outbox_ids (key, id)
select 'terminal_event', outbox_row.id
from private.domain_event_outbox outbox_row
where outbox_row.idempotency_key = 'n1a-terminal-event';

select ok((select count(*) = 1 from private.claim_domain_events(1)), 'S: terminal candidate claimed');

insert into n1a_outbox_ids (key, token)
select 'terminal_token', outbox_row.lease_token
from private.domain_event_outbox outbox_row
where outbox_row.id = (select id from n1a_outbox_ids where key = 'terminal_event');

select ok(
  private.fail_domain_event_retryable(
    (select id from n1a_outbox_ids where key = 'organisation'),
    (select id from n1a_outbox_ids where key = 'terminal_event'),
    (select token from n1a_outbox_ids where key = 'terminal_token'),
    'max_attempts',
    null
  ),
  'T: retryable failure escalates at max attempts'
);

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_outbox_ids where key = 'terminal_event')
  ),
  'failed',
  'U: max attempts produce terminal failed state'
);

insert into private.domain_event_outbox (
  organisation_id,
  event_type,
  payload,
  idempotency_key,
  processing_state,
  available_at,
  processing_started_at,
  lease_expires_at,
  lease_token,
  attempt_count
)
values (
  (select id from n1a_outbox_ids where key = 'organisation'),
  'ExpiredLeaseEvent',
  '{}'::jsonb,
  'n1a-expired-lease',
  'processing',
  statement_timestamp(),
  statement_timestamp() - interval '10 minutes',
  statement_timestamp() - interval '1 minute',
  gen_random_uuid(),
  1
);

select ok(
  (select count(*) = 1 from private.claim_domain_events(1)),
  'V: expired processing lease is reclaimed'
);

select is(
  (
    select count(*)::integer
    from private.claim_domain_events(10)
    where id = (select id from n1a_outbox_ids where key = 'event')
  ),
  0,
  'W: processed events are not reclaimable'
);

select is(
  (
    select count(*)::integer
    from private.claim_domain_events(10)
    where id = (select id from n1a_outbox_ids where key = 'terminal_event')
  ),
  0,
  'X: terminal failed events are not reclaimable'
);

reset role;

set local role authenticated;

select throws_ok(
  'select * from private.domain_event_outbox',
  '42501',
  null,
  'Y: authenticated cannot read outbox'
);

select throws_ok(
  'select private.claim_domain_events(1)',
  '42501',
  null,
  'Z: authenticated cannot claim outbox events'
);

reset role;

select * from finish();
rollback;
