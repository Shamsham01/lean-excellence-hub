begin;

select plan(12);

create temporary table n1e_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on n1e_ids to service_role, lean_hub_private_owner;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'n1e-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'n1e-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd2000000-0000-0000-0000-000000000003',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into n1e_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'd2000000-0000-0000-0000-000000000001',
      'n1e-display-org-a',
      'N1e Display Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'd2000000-0000-0000-0000-000000000002',
      'n1e-display-org-b',
      'N1e Display Org B'
    )
  );

insert into n1e_ids (key, id)
select
  'membership_a',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1e_ids where key = 'org_a')
  and membership_row.user_id = 'd2000000-0000-0000-0000-000000000001';

set local role lean_hub_private_owner;

update public.profiles
set display_name = 'Przem Admin Test'
where user_id = 'd2000000-0000-0000-0000-000000000001';

update public.organisation_memberships
set display_name = null
where id = (select id from n1e_ids where key = 'membership_a');

insert into n1e_ids (key, id)
select
  'event_a',
  private.enqueue_domain_event(
    (select id from n1e_ids where key = 'org_a'),
    null,
    'JobFunctionAssigned',
    'n1e-display-event-a',
    jsonb_build_object(
      'membership_id',
      (select id::text from n1e_ids where key = 'membership_a')
    )
  );

insert into n1e_ids (key, id)
select
  'delivery_a',
  private.create_notification_delivery(
    (select id from n1e_ids where key = 'org_a'),
    (select id from n1e_ids where key = 'event_a'),
    (select id from n1e_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'n1e-display-key-a'
  );

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'Przem Admin Test',
  'A: profile display name is used when membership display name is blank'
);

set local role lean_hub_private_owner;

update public.organisation_memberships
set display_name = 'Org Specific Name'
where id = (select id from n1e_ids where key = 'membership_a');

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'Org Specific Name',
  'B: organisation membership display name overrides profile display name'
);

set local role lean_hub_private_owner;

update public.organisation_memberships
set display_name = null
where id = (select id from n1e_ids where key = 'membership_a');

update public.profiles
set display_name = null
where user_id = 'd2000000-0000-0000-0000-000000000001';

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  null,
  'C: no fabricated Team member placeholder when both names are absent'
);

select isnt(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'Team member',
  'D: Team member is never returned as recipient display name'
);

set local role lean_hub_private_owner;

update public.profiles
set display_name = 'Other User Profile'
where user_id = 'd2000000-0000-0000-0000-000000000002';

reset role;

set local role service_role;

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_b'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    )
  ),
  0,
  'E: forged organisation id returns no context'
);

set local role lean_hub_private_owner;

update public.profiles
set display_name = 'Przem Admin Test'
where user_id = 'd2000000-0000-0000-0000-000000000001';

reset role;

set local role service_role;

select is(
  (
    select context_row.deliverable_email
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'n1e-owner-a@example.test',
  'F: deliverable email resolution remains unchanged'
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
  (select id from n1e_ids where key = 'org_a'),
  (select id from n1e_ids where key = 'membership_a'),
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
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'workforce-contact@example.test',
  'G: explicit notification contact still overrides auth email'
);

set local role lean_hub_private_owner;

update public.organisation_memberships
set status = 'inactive',
    inactivated_at = statement_timestamp(),
    status_reason = 'test inactivation'
where id = (select id from n1e_ids where key = 'membership_a');

insert into n1e_ids (key, id)
select
  'delivery_inactive',
  private.create_notification_delivery(
    (select id from n1e_ids where key = 'org_a'),
    (select id from n1e_ids where key = 'event_a'),
    (select id from n1e_ids where key = 'membership_a'),
    'workforce.job_function_assigned',
    'n1e-display-key-inactive'
  );

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_inactive'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'inactive_membership',
  'H: inactive membership behavior remains unchanged'
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
  (select id from n1e_ids where key = 'org_a'),
  'd2000000-0000-0000-0000-000000000003',
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
  'd2000000-0000-0000-0000-000000000003',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
  'disabled'
);

insert into n1e_ids (key, id)
select
  'membership_workforce',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from n1e_ids where key = 'org_a')
  and membership_row.user_id = 'd2000000-0000-0000-0000-000000000003';

insert into n1e_ids (key, id)
select
  'delivery_workforce',
  private.create_notification_delivery(
    (select id from n1e_ids where key = 'org_a'),
    (select id from n1e_ids where key = 'event_a'),
    (select id from n1e_ids where key = 'membership_workforce'),
    'workforce.job_function_assigned',
    'n1e-display-key-workforce'
  );

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_workforce'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'disabled_workforce_account',
  'I: disabled workforce account behavior remains unchanged'
);

set local role lean_hub_private_owner;

update public.profiles
set display_name = 'Should Not Leak'
where user_id = 'd2000000-0000-0000-0000-000000000002';

update public.profiles
set display_name = null
where user_id = 'd2000000-0000-0000-0000-000000000001';

update public.organisation_memberships
set display_name = null
where id = (select id from n1e_ids where key = 'membership_a');

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_a'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  null,
  'J: another user profile cannot be selected for recipient display name'
);

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_workforce'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'Workforce Member',
  'K: membership display name still resolves for workforce recipients'
);

set local role lean_hub_private_owner;

update public.profiles
set display_name = 'Wrong Profile Name'
where user_id = 'd2000000-0000-0000-0000-000000000003';

reset role;

set local role service_role;

select is(
  (
    select context_row.recipient_display_name
    from public.get_notification_delivery_context_for_worker(
      (select id from n1e_ids where key = 'org_a'),
      (select id from n1e_ids where key = 'delivery_workforce'),
      (select id from n1e_ids where key = 'event_a')
    ) context_row
  ),
  'Workforce Member',
  'L: workforce recipient keeps membership display name over profile display name'
);

reset role;

select * from finish();

rollback;
