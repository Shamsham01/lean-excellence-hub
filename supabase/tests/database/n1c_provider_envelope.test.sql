begin;

select plan(8);

create temporary table n1c_envelope_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on n1c_envelope_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'd2000000-0000-0000-0000-000000000001',
  'n1c-envelope-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into n1c_envelope_ids (key, id)
values (
  'org',
  private.provision_organisation(
    'd2000000-0000-0000-0000-000000000001',
    'n1c-envelope-org',
    'N1c Envelope Org'
  )
);

insert into n1c_envelope_ids (key, id)
select
  'membership',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1c_envelope_ids where key = 'org')
  and membership_row.user_id = 'd2000000-0000-0000-0000-000000000001';

set local role lean_hub_private_owner;

insert into n1c_envelope_ids (key, id)
select
  'event',
  private.enqueue_domain_event(
    (select id from n1c_envelope_ids where key = 'org'),
    null,
    'JobFunctionAssigned',
    'n1c-envelope-event',
    jsonb_build_object(
      'membership_id',
      (select id::text from n1c_envelope_ids where key = 'membership')
    )
  );

insert into n1c_envelope_ids (key, id)
select
  'delivery',
  private.create_notification_delivery(
    (select id from n1c_envelope_ids where key = 'org'),
    (select id from n1c_envelope_ids where key = 'event'),
    (select id from n1c_envelope_ids where key = 'membership'),
    'workforce.job_function_assigned',
    'n1c-envelope-delivery-key'
  );

reset role;

set local role anon;

select throws_ok(
  $$select * from public.get_notification_delivery_provider_envelope_for_worker(
    (select id from n1c_envelope_ids where key = 'org'),
    (select id from n1c_envelope_ids where key = 'delivery')
  )$$,
  '42501',
  null,
  'A: anon cannot read provider envelope'
);

reset role;

set local role service_role;

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_provider_envelope_for_worker(
      (select id from n1c_envelope_ids where key = 'org'),
      (select id from n1c_envelope_ids where key = 'delivery')
    )
  ),
  0,
  'B: envelope absent before first store'
);

create temporary table n1c_envelope_store as
select *
from public.store_notification_delivery_provider_envelope_for_worker(
  (select id from n1c_envelope_ids where key = 'org'),
  (select id from n1c_envelope_ids where key = 'delivery'),
  'n1c-envelope-delivery-key',
  'Lean Excellence Hub <notify@example.test>',
  'n1c-envelope-owner@example.test',
  'Subject one',
  '<p>Html one</p>',
  'Text one',
  repeat('a', 64)
);

select ok(
  exists (
    select 1
    from n1c_envelope_store stored
    where stored.subject = 'Subject one'
      and stored.recipient_email = 'n1c-envelope-owner@example.test'
  ),
  'C: service_role can store provider envelope'
);

select is(
  (
    select stored.subject
    from public.store_notification_delivery_provider_envelope_for_worker(
      (select id from n1c_envelope_ids where key = 'org'),
      (select id from n1c_envelope_ids where key = 'delivery'),
      'n1c-envelope-delivery-key',
      'Lean Excellence Hub <notify@example.test>',
      'n1c-envelope-owner@example.test',
      'Subject one',
      '<p>Html one</p>',
      'Text one',
      repeat('a', 64)
    ) stored
    limit 1
  ),
  'Subject one',
  'D: repeated store returns existing immutable envelope'
);

select throws_ok(
  $$select * from public.store_notification_delivery_provider_envelope_for_worker(
    (select id from n1c_envelope_ids where key = 'org'),
    (select id from n1c_envelope_ids where key = 'delivery'),
    'n1c-envelope-delivery-key',
    'Lean Excellence Hub <notify@example.test>',
    'changed@example.test',
    'Different subject',
    '<p>Different</p>',
    'Different',
    repeat('b', 64)
  )$$,
  '23505',
  null,
  'E: conflicting payload hash is rejected'
);

reset role;

set local role authenticated;

select throws_ok(
  $$select * from private.get_notification_delivery_provider_envelope(
    (select id from n1c_envelope_ids where key = 'org'),
    (select id from n1c_envelope_ids where key = 'delivery')
  )$$,
  '42501',
  null,
  'F: authenticated cannot execute private envelope function'
);

reset role;

set local role service_role;

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_provider_envelope_for_worker(
      gen_random_uuid(),
      (select id from n1c_envelope_ids where key = 'delivery')
    )
  ),
  0,
  'G: forged organisation id returns no envelope'
);

select ok(
  not has_table_privilege('anon', 'private.notification_delivery_provider_envelopes', 'SELECT'),
  'H: anon cannot read private envelope table directly'
);

select * from finish();

rollback;
