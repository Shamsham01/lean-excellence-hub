\set ON_ERROR_STOP on
begin;

drop table if exists private._t119_conc_ids;
create table private._t119_conc_ids (key text primary key, id uuid);
grant select on private._t119_conc_ids to authenticated, lean_hub_private_owner, service_role;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'f119c000-0000-4000-8000-000000000001',
  't119conc-operator@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f119c000-0000-4000-8000-000000000002',
  't119conc-site-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f119c000-0000-4000-8000-000000000003',
  't119conc-other-site-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f119c000-0000-4000-8000-000000000004',
  't119conc-delegate@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f119c000-0000-4000-8000-000000000005',
  't119conc-alt-delegate@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
)
on conflict (id) do nothing;

insert into private._t119_conc_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f119c000-0000-4000-8000-000000000001',
  't119c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    'T119 Conc Delegation Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'f119c100-0000-4000-8000-000000000001',
  'f119c000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'f119c100-0000-4000-8000-000000000002',
  'f119c000-0000-4000-8000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'f119c100-0000-4000-8000-000000000003',
  'f119c000-0000-4000-8000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'f119c100-0000-4000-8000-000000000004',
  'f119c000-0000-4000-8000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'f119c100-0000-4000-8000-000000000005',
  'f119c000-0000-4000-8000-000000000005',
  statement_timestamp(), statement_timestamp()
)
on conflict (id) do nothing;

insert into private._t119_conc_ids (key, id)
select 'operator_membership', id
from public.organisation_memberships
where organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
  and user_id = 'f119c000-0000-4000-8000-000000000001';

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select (select id from private._t119_conc_ids where key = 'organisation'), user_row.id, 'active', statement_timestamp()
from (values
  ('f119c000-0000-4000-8000-000000000002'::uuid),
  ('f119c000-0000-4000-8000-000000000003'::uuid),
  ('f119c000-0000-4000-8000-000000000004'::uuid),
  ('f119c000-0000-4000-8000-000000000005'::uuid)
) as user_row(id);

insert into private._t119_conc_ids (key, id)
select key, membership_row.id
from (
  values
    ('site_manager_membership', 'f119c000-0000-4000-8000-000000000002'::uuid),
    ('other_site_manager_membership', 'f119c000-0000-4000-8000-000000000003'::uuid),
    ('delegate_membership', 'f119c000-0000-4000-8000-000000000004'::uuid),
    ('alternate_delegate_membership', 'f119c000-0000-4000-8000-000000000005'::uuid)
) seed(key, user_id)
join public.organisation_memberships membership_row
  on membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
 and membership_row.user_id = seed.user_id;

update private.identity_controls identity_row
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where identity_row.user_id in (
  'f119c000-0000-4000-8000-000000000002',
  'f119c000-0000-4000-8000-000000000003',
  'f119c000-0000-4000-8000-000000000004',
  'f119c000-0000-4000-8000-000000000005'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000001","email":"t119conc-operator@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'operator selects organisation'
);

insert into private._t119_conc_ids (key, id)
select 'unit_site', public.create_organisation_unit(
  (select id from private._t119_conc_ids where key = 'organisation'),
  null,
  'prod-site',
  'Production Site',
  'site'
);

insert into private._t119_conc_ids (key, id)
select 'unit_other_site', public.create_organisation_unit(
  (select id from private._t119_conc_ids where key = 'organisation'),
  null,
  'other-site',
  'Other Site',
  'site'
);

insert into private._t119_conc_ids (key, id)
select 'unit_line1', public.create_organisation_unit(
  (select id from private._t119_conc_ids where key = 'organisation'),
  (select id from private._t119_conc_ids where key = 'unit_site'),
  'prod-line-1',
  'Prod Line 1',
  'line'
);

insert into private._t119_conc_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from private._t119_conc_ids where key = 'organisation'),
  't119-manager',
  'T119 Manager',
  'Manager for approval routing tests'
);

  public.add_role_permission(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'suggestions.review'
  ),
  'manager role receives suggestions.review'
);

  public.add_role_permission(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'suggestions.manage'
  ),
  'manager role receives suggestions.manage for override delegation retries'
);

  public.publish_role_version(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'manager_role')
  ),
  'manager role publishes'
);

insert into private._t119_conc_ids (key, id)
select
  'site_manager_grant',
  public.grant_role_version(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'site_manager_membership'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from private._t119_conc_ids where key = 'unit_site')
  );

  (select id from private._t119_conc_ids where key = 'site_manager_grant') is not null,
  'site manager scoped to production site subtree'
);

  public.grant_role_version(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'other_site_manager_membership'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from private._t119_conc_ids where key = 'unit_other_site')
  ) is not null,
  'other site manager scoped to other site subtree'
);

insert into private._t119_conc_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

  public.assign_membership_job_function(
    (select id from private._t119_conc_ids where key = 'operator_membership'),
    (select id from private._t119_conc_ids where key = 'job_function'),
    true,
    (select id from private._t119_conc_ids where key = 'unit_line1')
  ) is not null,
  'operator primary job assignment on prod line 1'
);

insert into private._t119_conc_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into private._t119_conc_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from private._t119_conc_ids where key = 'programme')
  and programme_version.version_number = 1;

  public.publish_suggestion_programme_version((select id from private._t119_conc_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into private._t119_conc_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into private._t119_conc_ids (key, id)
select 'suggestion_draft', public.create_suggestion_draft(
  (select id from private._t119_conc_ids where key = 'programme_version'),
  (select id from private._t119_conc_ids where key = 'category'),
  'T119 draft must not notify',
  'Problem text',
  'Idea text',
  'Benefit text'
);

reset role;
set local role lean_hub_private_owner;

  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  0::bigint,
  'draft suggestion creates no awaiting_review notifications'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000001","email":"t119conc-operator@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'operator selects organisation for submit'
);

-- Create suggestion with line origin (jurisdiction = line)
insert into private._t119_conc_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from private._t119_conc_ids where key = 'programme_version'),
  (select id from private._t119_conc_ids where key = 'category'),
  'T119 conc race suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

update public.improvement_suggestions suggestion_row
set origin_unit_id = (select id from private._t119_conc_ids where key = 'unit_line1')
where suggestion_row.id = (select id from private._t119_conc_ids where key = 'suggestion')
  and suggestion_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation');

  public.submit_suggestion((select id from private._t119_conc_ids where key = 'suggestion')),
  'operator submits suggestion on prod line 1'
);

reset role;
set local role lean_hub_private_owner;

  (
    select count(*)::bigint
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionSubmitted'
      and outbox_row.resource_record_id = (select id from private._t119_conc_ids where key = 'suggestion')
  ),
  1::bigint,
  'submit enqueues exactly one SuggestionSubmitted outbox row'
);

  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and notification_row.membership_id = (select id from private._t119_conc_ids where key = 'site_manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  1::bigint,
  'site-scoped production manager receives in-app approval request for line suggestion'
);

  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and notification_row.membership_id = (select id from private._t119_conc_ids where key = 'other_site_manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  0::bigint,
  'other site manager does not receive cross-site approval notification'
);

  private.is_suggestion_primary_approver(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'suggestion'),
    (select id from private._t119_conc_ids where key = 'site_manager_membership')
  ),
  'site manager is snapshotted primary approver'
);

  (
    select routing_row.notification_generation
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and routing_row.suggestion_id = (select id from private._t119_conc_ids where key = 'suggestion')
  ),
  1,
  'submit snapshots notification generation 1'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000001","email":"t119conc-operator@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'operator selects organisation for delegate grant'
);

insert into private._t119_conc_ids (key, id)
select
  'delegate_grant',
  public.grant_role_version(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'delegate_membership'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from private._t119_conc_ids where key = 'unit_site')
  );

  (select id from private._t119_conc_ids where key = 'delegate_grant') is not null,
  'delegate reviewer scoped to production site subtree'
);

  public.grant_role_version(
    (select id from private._t119_conc_ids where key = 'organisation'),
    (select id from private._t119_conc_ids where key = 'alternate_delegate_membership'),
    (select id from private._t119_conc_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from private._t119_conc_ids where key = 'unit_site')
  ) is not null,
  'alternate delegate scoped to production site subtree'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'site manager selects organisation'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000003","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000003","email":"t119conc-other-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'wrong-site manager selects organisation'
);

  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from private._t119_conc_ids where key = 'suggestion'),
    (select id from private._t119_conc_ids where key = 'delegate_membership'),
    'cross-site delegate'
  ),
  'approval delegation is not authorised',
  'wrong-site manager cannot delegate approval'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'site manager returns for delegation'
);

set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'inactive',
  inactivated_at = statement_timestamp(),
  status_reason = 't119 inactive actor fixture'
where membership_row.id = (select id from private._t119_conc_ids where key = 'site_manager_membership')
  and membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation');

set local role authenticated;

  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from private._t119_conc_ids where key = 'suggestion'),
    (select id from private._t119_conc_ids where key = 'delegate_membership'),
    'inactive actor'
  ),
  'approval delegation is not authorised',
  'inactive delegating actor is rejected before idempotent paths'
);

reset role;
set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'active',
  inactivated_at = null,
  status_reason = null
where membership_row.id = (select id from private._t119_conc_ids where key = 'site_manager_membership')
  and membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'reactivated site manager for delegation'
);

reset role;
set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'inactive',
  inactivated_at = statement_timestamp(),
  status_reason = 't119 inactive delegate fixture'
where membership_row.id = (select id from private._t119_conc_ids where key = 'delegate_membership')
  and membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'site manager for inactive delegate attempt'
);

  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from private._t119_conc_ids where key = 'suggestion'),
    (select id from private._t119_conc_ids where key = 'delegate_membership'),
    'inactive target'
  ),
  'inactive membership cannot be assigned as reviewer',
  'inactive delegate target is rejected'
);

reset role;
set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'active',
  inactivated_at = null,
  status_reason = null
where membership_row.id = (select id from private._t119_conc_ids where key = 'delegate_membership')
  and membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000002","email":"t119conc-site-manager@example.test"}',
  true
);
set local role authenticated;

  public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation')),
  'site manager for delegation'
);

insert into private._t119_conc_ids (key, id)
select
commit;
