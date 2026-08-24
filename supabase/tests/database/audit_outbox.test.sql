begin;

select plan(4);

select ok(
  to_regclass('public.business_audit_events') is not null,
  'business audit table exists'
);

select ok(
  to_regclass('private.domain_event_outbox') is not null,
  'private outbox table exists'
);

set local role authenticated;

select throws_ok(
  'select * from public.business_audit_events',
  '42501',
  null,
  'business audit is default-deny for authenticated'
);

select throws_ok(
  'select * from private.domain_event_outbox',
  '42501',
  null,
  'outbox is not readable by authenticated'
);

reset role;

select * from finish();
rollback;
