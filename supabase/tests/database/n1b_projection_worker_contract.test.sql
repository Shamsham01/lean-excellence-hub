begin;

select plan(8);

create temporary table n1b_projection_ids (
  key text primary key,
  id uuid,
  token uuid
) on commit drop;

grant select, insert, update on n1b_projection_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'n1b-projection-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'n1b-projection-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into n1b_projection_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'e1000000-0000-0000-0000-000000000001',
      'n1b-projection-org-a',
      'N1b Projection Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'e1000000-0000-0000-0000-000000000002',
      'n1b-projection-org-b',
      'N1b Projection Org B'
    )
  );

insert into n1b_projection_ids (key, id)
select
  'membership_a',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1b_projection_ids where key = 'org_a')
  and membership_row.user_id = 'e1000000-0000-0000-0000-000000000001';

insert into n1b_projection_ids (key, id)
select
  'membership_b',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1b_projection_ids where key = 'org_b')
  and membership_row.user_id = 'e1000000-0000-0000-0000-000000000002';

set local role lean_hub_private_owner;

insert into n1b_projection_ids (key, id)
select
  'event_a',
  private.enqueue_domain_event(
    (select id from n1b_projection_ids where key = 'org_a'),
    null,
    'JobFunctionAssigned',
    'n1b-projection-event-a',
    jsonb_build_object(
      'membership_id',
      (select id::text from n1b_projection_ids where key = 'membership_a')
    )
  );

reset role;

set local role anon;

select throws_ok(
  'select public.create_notification_delivery_for_worker(
     (select id from n1b_projection_ids where key = ''org_a''),
     (select id from n1b_projection_ids where key = ''event_a''),
     (select id from n1b_projection_ids where key = ''membership_a''),
     ''workforce.job_function_assigned'',
     ''n1b-projection-delivery-key''
   )',
  '42501',
  null,
  'A: anon cannot create notification deliveries through worker RPC'
);

reset role;

set local role authenticated;

select throws_ok(
  'select public.create_notification_delivery_for_worker(
     (select id from n1b_projection_ids where key = ''org_a''),
     (select id from n1b_projection_ids where key = ''event_a''),
     (select id from n1b_projection_ids where key = ''membership_a''),
     ''workforce.job_function_assigned'',
     ''n1b-projection-delivery-key''
   )',
  '42501',
  null,
  'B: authenticated cannot create notification deliveries through worker RPC'
);

reset role;

set local role service_role;

create temporary table n1b_projection_claim (
  organisation_id uuid,
  event_id uuid,
  resource_record_id uuid,
  event_type text,
  payload jsonb,
  lease_token uuid,
  attempt_count integer
) on commit drop;

insert into n1b_projection_claim
select *
from public.claim_domain_events_for_worker(10)
where event_id = (select id from n1b_projection_ids where key = 'event_a');

insert into n1b_projection_ids (key, token)
select
  'claim_token',
  claimed.lease_token
from n1b_projection_claim claimed;

select ok(
  exists (
    select 1
    from n1b_projection_claim claimed
    where claimed.event_id = (select id from n1b_projection_ids where key = 'event_a')
  ),
  'C: service_role can claim projection source event through worker RPC'
);

insert into n1b_projection_ids (key, id)
select
  'delivery_a',
  public.create_notification_delivery_for_worker(
    (select id from n1b_projection_ids where key = 'org_a'),
    (select id from n1b_projection_ids where key = 'event_a'),
    (select id from n1b_projection_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'workforce.job_function_assigned:' || (select id::text from n1b_projection_ids where key = 'event_a') || ':' || (select id::text from n1b_projection_ids where key = 'membership_a')
  );

select ok(
  (select id from n1b_projection_ids where key = 'delivery_a') is not null,
  'D: service_role can create deterministic projection delivery'
);

select is(
  public.create_notification_delivery_for_worker(
    (select id from n1b_projection_ids where key = 'org_a'),
    (select id from n1b_projection_ids where key = 'event_a'),
    (select id from n1b_projection_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'workforce.job_function_assigned:' || (select id::text from n1b_projection_ids where key = 'event_a') || ':' || (select id::text from n1b_projection_ids where key = 'membership_a')
  ),
  (select id from n1b_projection_ids where key = 'delivery_a'),
  'E: duplicate projection delivery key is idempotent'
);

select throws_ok(
  $$
    select public.create_notification_delivery_for_worker(
      (select id from n1b_projection_ids where key = 'org_a'),
      (select id from n1b_projection_ids where key = 'event_a'),
      (select id from n1b_projection_ids where key = 'membership_a'),
      'workforce.training_completed',
      'workforce.job_function_assigned:' || (select id::text from n1b_projection_ids where key = 'event_a') || ':' || (select id::text from n1b_projection_ids where key = 'membership_a')
    )
  $$,
  '23505',
  'delivery_key already exists with different immutable identity',
  'F: conflicting projection delivery identity is rejected'
);

select throws_ok(
  $$
    select public.create_notification_delivery_for_worker(
      (select id from n1b_projection_ids where key = 'org_a'),
      (select id from n1b_projection_ids where key = 'event_a'),
      (select id from n1b_projection_ids where key = 'membership_b'),
      'workforce.job_function_assigned',
      'n1b-projection-cross-tenant'
    )
  $$,
  '23514',
  'recipient membership organisation mismatch',
  'G: cross-tenant recipient linkage is blocked through worker RPC'
);

select ok(
  public.complete_domain_event_for_worker(
    (select id from n1b_projection_ids where key = 'org_a'),
    (select id from n1b_projection_ids where key = 'event_a'),
    (select token from n1b_projection_ids where key = 'claim_token')
  ),
  'H: projection source event completes through worker RPC after delivery creation'
);

select * from finish();
rollback;
