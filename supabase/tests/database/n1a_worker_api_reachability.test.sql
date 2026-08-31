begin;

select plan(17);

create temporary table n1a_worker_ids (
  key text primary key,
  id uuid,
  token uuid
) on commit drop;

grant select, insert, update on n1a_worker_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'n1a-worker-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'n1a-worker-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into n1a_worker_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'f1000000-0000-0000-0000-000000000001',
      'n1a-worker-org-a',
      'N1a Worker Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'f1000000-0000-0000-0000-000000000002',
      'n1a-worker-org-b',
      'N1a Worker Org B'
    )
  );

set local role lean_hub_private_owner;

insert into n1a_worker_ids (key, id)
select
  'event_a',
  private.enqueue_domain_event(
    (select id from n1a_worker_ids where key = 'org_a'),
    null,
    'WorkerApiEvent',
    'n1a-worker-api-event',
    '{"worker":true}'::jsonb
  );

insert into n1a_worker_ids (key, id)
select
  'membership_a',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1a_worker_ids where key = 'org_a')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001';

reset role;

set local role anon;

select throws_ok(
  'select * from public.claim_domain_events_for_worker(1)',
  '42501',
  null,
  'A: anon cannot execute claim_domain_events_for_worker'
);

select throws_ok(
  'select public.complete_domain_event_for_worker(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())',
  '42501',
  null,
  'B: anon cannot execute complete_domain_event_for_worker'
);

reset role;

set local role authenticated;

select throws_ok(
  'select * from public.claim_domain_events_for_worker(1)',
  '42501',
  null,
  'C: authenticated cannot execute claim_domain_events_for_worker'
);

select throws_ok(
  'select public.create_notification_delivery_for_worker(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ''kind'', ''key'')',
  '42501',
  null,
  'D: authenticated cannot execute create_notification_delivery_for_worker'
);

reset role;

set local role service_role;

select ok(
  to_regprocedure('public.claim_domain_events_for_worker(integer,integer)') is not null,
  'E: public claim_domain_events_for_worker exists'
);

create temporary table n1a_worker_claim (
  organisation_id uuid,
  event_id uuid,
  resource_record_id uuid,
  event_type text,
  payload jsonb,
  lease_token uuid,
  attempt_count integer
) on commit drop;

insert into n1a_worker_claim
select *
from public.claim_domain_events_for_worker(10);

insert into n1a_worker_ids (key, token)
select
  'claim_token',
  claimed.lease_token
from n1a_worker_claim claimed
where claimed.event_id = (select id from n1a_worker_ids where key = 'event_a');

select ok(
  exists (
    select 1
    from n1a_worker_claim claimed
    where claimed.event_id = (select id from n1a_worker_ids where key = 'event_a')
      and claimed.organisation_id = (select id from n1a_worker_ids where key = 'org_a')
      and claimed.event_type = 'WorkerApiEvent'
      and claimed.payload = '{"worker": true}'::jsonb
      and claimed.attempt_count = 1
      and claimed.lease_token is not null
  ),
  'F: service_role claim returns worker-required event fields'
);

select ok(
  not public.complete_domain_event_for_worker(
    (select id from n1a_worker_ids where key = 'org_a'),
    (select id from n1a_worker_ids where key = 'event_a'),
    gen_random_uuid()
  ),
  'G: stale lease_token is rejected through public complete wrapper'
);

select ok(
  public.complete_domain_event_for_worker(
    (select id from n1a_worker_ids where key = 'org_a'),
    (select id from n1a_worker_ids where key = 'event_a'),
    (select token from n1a_worker_ids where key = 'claim_token')
  ),
  'H: valid lease_token completes through public complete wrapper'
);

set local role lean_hub_private_owner;

select is(
  (
    select outbox_row.processing_state
    from private.domain_event_outbox outbox_row
    where outbox_row.id = (select id from n1a_worker_ids where key = 'event_a')
  ),
  'processed',
  'I: public complete wrapper marks event processed'
);

insert into n1a_worker_ids (key, id)
select
  'event_b',
  private.enqueue_domain_event(
    (select id from n1a_worker_ids where key = 'org_b'),
    null,
    'WorkerApiEventB',
    'n1a-worker-api-event-b',
    '{}'::jsonb
  );

set local role service_role;

select ok(
  not public.complete_domain_event_for_worker(
    (select id from n1a_worker_ids where key = 'org_a'),
    (select id from n1a_worker_ids where key = 'event_b'),
    (select token from n1a_worker_ids where key = 'claim_token')
  ),
  'J: cross-tenant complete is rejected through public wrapper'
);

set local role service_role;

select ok(
  public.create_notification_delivery_for_worker(
    (select id from n1a_worker_ids where key = 'org_a'),
    (select id from n1a_worker_ids where key = 'event_a'),
    (select id from n1a_worker_ids where key = 'membership_a'),
    'workforce.worker_api',
    'n1a-worker-delivery-key'
  ) is not null,
  'K: service_role can create delivery through public worker RPC'
);

insert into n1a_worker_ids (key, id, token)
select
  'delivery',
  claimed.delivery_id,
  claimed.lease_token
from public.claim_notification_deliveries_for_worker(10) as claimed
where claimed.delivery_key = 'n1a-worker-delivery-key';

select is(
  (select count(*)::integer from n1a_worker_ids where key = 'delivery' and id is not null),
  1,
  'L: service_role can claim delivery through public worker RPC'
);

select ok(
  public.complete_notification_delivery_for_worker(
    (select id from n1a_worker_ids where key = 'org_a'),
    (select id from n1a_worker_ids where key = 'delivery'),
    (select token from n1a_worker_ids where key = 'delivery'),
    'provider-worker-api'
  ),
  'M: public delivery complete wrapper accepts valid lease token'
);

reset role;

set local role anon;

select throws_ok(
  'select * from public.claim_notification_deliveries_for_worker(1)',
  '42501',
  null,
  'N: anon cannot execute claim_notification_deliveries_for_worker'
);

reset role;

set local role authenticated;

select throws_ok(
  'select public.complete_notification_delivery_for_worker(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())',
  '42501',
  null,
  'O: authenticated cannot execute complete_notification_delivery_for_worker'
);

reset role;

select ok(
  exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'claim_domain_events_for_worker'
  ),
  'P: worker wrapper is published in public schema for PostgREST'
);

select ok(
  not exists (
    select 1
    from information_schema.routine_privileges privilege_row
    where privilege_row.routine_schema = 'private'
      and privilege_row.routine_name = 'claim_domain_events'
      and privilege_row.grantee in ('anon', 'authenticated')
      and privilege_row.privilege_type = 'EXECUTE'
  ),
  'Q: private worker RPCs remain non-executable by anon/authenticated'
);

select * from finish();
rollback;
