begin;

select plan(12);

create temporary table n1c_delivery_ids (
  key text primary key,
  id uuid,
  token uuid
) on commit drop;

grant select, insert, update on n1c_delivery_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'n1c-delivery-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'n1c-delivery-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into n1c_delivery_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'd1000000-0000-0000-0000-000000000001',
      'n1c-delivery-org-a',
      'N1c Delivery Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'd1000000-0000-0000-0000-000000000002',
      'n1c-delivery-org-b',
      'N1c Delivery Org B'
    )
  );

insert into n1c_delivery_ids (key, id)
select
  'membership_a',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1c_delivery_ids where key = 'org_a')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000001';

insert into n1c_delivery_ids (key, id)
select
  'membership_b',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1c_delivery_ids where key = 'org_b')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000002';

set local role lean_hub_private_owner;

insert into n1c_delivery_ids (key, id)
select
  'event_a',
  private.enqueue_domain_event(
    (select id from n1c_delivery_ids where key = 'org_a'),
    null,
    'JobFunctionAssigned',
    'n1c-delivery-event-a',
    jsonb_build_object(
      'membership_id',
      (select id::text from n1c_delivery_ids where key = 'membership_a')
    )
  );

insert into n1c_delivery_ids (key, id)
select
  'delivery_a',
  private.create_notification_delivery(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'event_a'),
    (select id from n1c_delivery_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'n1c-delivery-key-a'
  );

reset role;

set local role anon;

select throws_ok(
  $$select * from public.get_notification_delivery_context_for_worker(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'delivery_a'),
    (select id from n1c_delivery_ids where key = 'event_a')
  )$$,
  '42501',
  null,
  'A: anon cannot execute get_notification_delivery_context_for_worker'
);

reset role;

set local role authenticated;

select throws_ok(
  $$select * from public.get_notification_delivery_context_for_worker(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'delivery_a'),
    (select id from n1c_delivery_ids where key = 'event_a')
  )$$,
  '42501',
  null,
  'B: authenticated cannot execute get_notification_delivery_context_for_worker'
);

reset role;

set local role service_role;

select ok(
  to_regprocedure(
    'public.get_notification_delivery_context_for_worker(uuid,uuid,uuid)'
  ) is not null,
  'C: public get_notification_delivery_context_for_worker exists'
);

create temporary table n1c_context_result as
select *
from public.get_notification_delivery_context_for_worker(
  (select id from n1c_delivery_ids where key = 'org_a'),
  (select id from n1c_delivery_ids where key = 'delivery_a'),
  (select id from n1c_delivery_ids where key = 'event_a')
);

select ok(
  exists (
    select 1
    from n1c_context_result context_row
    where context_row.organisation_id = (select id from n1c_delivery_ids where key = 'org_a')
      and context_row.delivery_id = (select id from n1c_delivery_ids where key = 'delivery_a')
      and context_row.source_domain_event_id = (select id from n1c_delivery_ids where key = 'event_a')
      and context_row.notification_kind = 'workforce.job_function_assigned'
      and context_row.recipient_resolution_status = 'deliverable'
      and context_row.deliverable_email = 'n1c-delivery-owner-a@example.test'
      and context_row.organisation_name = 'N1c Delivery Org A'
  ),
  'D: service_role resolves invited-user auth email for active membership'
);

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_b'),
      (select id from n1c_delivery_ids where key = 'delivery_a'),
      (select id from n1c_delivery_ids where key = 'event_a')
    )
  ),
  0,
  'E: forged organisation id returns no context'
);

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_a'),
      gen_random_uuid(),
      (select id from n1c_delivery_ids where key = 'event_a')
    )
  ),
  0,
  'F: forged delivery id returns no context'
);

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_a'),
      (select id from n1c_delivery_ids where key = 'delivery_a'),
      gen_random_uuid()
    )
  ),
  0,
  'G: forged source event id returns no context'
);

set local role lean_hub_private_owner;

insert into public.membership_notification_contacts (
  organisation_id,
  membership_id,
  channel_type,
  contact_address,
  status,
  source
)
values (
  (select id from n1c_delivery_ids where key = 'org_a'),
  (select id from n1c_delivery_ids where key = 'membership_a'),
  'email',
  'workforce-contact@example.test',
  'active',
  'manual'
);

reset role;

set local role service_role;

select is(
  (
    select context_row.deliverable_email
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_a'),
      (select id from n1c_delivery_ids where key = 'delivery_a'),
      (select id from n1c_delivery_ids where key = 'event_a')
    ) context_row
  ),
  'workforce-contact@example.test',
  'H: explicit notification contact overrides auth email'
);

set local role lean_hub_private_owner;

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  display_name,
  status,
  activated_at
)
values (
  (select id from n1c_delivery_ids where key = 'org_a'),
  'd1000000-0000-0000-0000-000000000003',
  'Workforce Member',
  'active',
  statement_timestamp()
);

insert into private.workforce_accounts (
  user_id,
  internal_login_identifier,
  status
)
values (
  'd1000000-0000-0000-0000-000000000003',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
  'active'
);

insert into n1c_delivery_ids (key, id)
select
  'membership_workforce',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1c_delivery_ids where key = 'org_a')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000003';

insert into n1c_delivery_ids (key, id)
select
  'delivery_workforce',
  private.create_notification_delivery(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'event_a'),
    (select id from n1c_delivery_ids where key = 'membership_workforce'),
    'workforce.job_function_assigned',
    'n1c-delivery-key-workforce'
  );

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_a'),
      (select id from n1c_delivery_ids where key = 'delivery_workforce'),
      (select id from n1c_delivery_ids where key = 'event_a')
    ) context_row
  ),
  'synthetic_auth_email',
  'I: synthetic workforce auth email is not deliverable'
);

set local role lean_hub_private_owner;

update public.organisation_memberships
set status = 'inactive',
    inactivated_at = statement_timestamp(),
    status_reason = 'test inactivation'
where id = (select id from n1c_delivery_ids where key = 'membership_a');

insert into n1c_delivery_ids (key, id)
select
  'delivery_inactive',
  private.create_notification_delivery(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'event_a'),
    (select id from n1c_delivery_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'n1c-delivery-key-inactive'
  );

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from n1c_delivery_ids where key = 'org_a'),
      (select id from n1c_delivery_ids where key = 'delivery_inactive'),
      (select id from n1c_delivery_ids where key = 'event_a')
    ) context_row
  ),
  'inactive_membership',
  'J: inactive membership is not deliverable'
);

reset role;

set local role anon;

select throws_ok(
  $$select * from private.get_notification_delivery_context(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'delivery_a'),
    (select id from n1c_delivery_ids where key = 'event_a')
  )$$,
  '42501',
  null,
  'K: anon cannot execute private context function'
);

reset role;

set local role authenticated;

select throws_ok(
  $$select * from private.get_notification_delivery_context(
    (select id from n1c_delivery_ids where key = 'org_a'),
    (select id from n1c_delivery_ids where key = 'delivery_a'),
    (select id from n1c_delivery_ids where key = 'event_a')
  )$$,
  '42501',
  null,
  'L: authenticated cannot execute private context function'
);

reset role;

select * from finish();

rollback;
