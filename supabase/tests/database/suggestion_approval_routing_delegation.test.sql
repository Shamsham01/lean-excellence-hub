begin;

select plan(71);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'f1190000-0000-4000-8000-000000000001',
  't119-operator@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f1190000-0000-4000-8000-000000000002',
  't119-site-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f1190000-0000-4000-8000-000000000003',
  't119-other-site-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f1190000-0000-4000-8000-000000000004',
  't119-delegate@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f1190000-0000-4000-8000-000000000005',
  't119-alternate-delegate@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table t119_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on t119_ids to service_role, lean_hub_private_owner, authenticated;

insert into t119_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1190000-0000-4000-8000-000000000001',
    't119-org',
    'T119 Approval Routing Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'f1190100-0000-4000-8000-000000000001',
  'f1190000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'f1190100-0000-4000-8000-000000000002',
  'f1190000-0000-4000-8000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'f1190100-0000-4000-8000-000000000003',
  'f1190000-0000-4000-8000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'f1190100-0000-4000-8000-000000000004',
  'f1190000-0000-4000-8000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'f1190100-0000-4000-8000-000000000005',
  'f1190000-0000-4000-8000-000000000005',
  statement_timestamp(), statement_timestamp()
);

insert into t119_ids (key, id)
select 'operator_membership', id
from public.organisation_memberships
where organisation_id = (select id from t119_ids where key = 'organisation')
  and user_id = 'f1190000-0000-4000-8000-000000000001';

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select (select id from t119_ids where key = 'organisation'), user_row.id, 'active', statement_timestamp()
from (values
  ('f1190000-0000-4000-8000-000000000002'::uuid),
  ('f1190000-0000-4000-8000-000000000003'::uuid),
  ('f1190000-0000-4000-8000-000000000004'::uuid),
  ('f1190000-0000-4000-8000-000000000005'::uuid)
) as user_row(id);

insert into t119_ids (key, id)
select key, membership_row.id
from (
  values
    ('site_manager_membership', 'f1190000-0000-4000-8000-000000000002'::uuid),
    ('other_site_manager_membership', 'f1190000-0000-4000-8000-000000000003'::uuid),
    ('delegate_membership', 'f1190000-0000-4000-8000-000000000004'::uuid),
    ('alternate_delegate_membership', 'f1190000-0000-4000-8000-000000000005'::uuid)
) seed(key, user_id)
join public.organisation_memberships membership_row
  on membership_row.organisation_id = (select id from t119_ids where key = 'organisation')
 and membership_row.user_id = seed.user_id;

update private.identity_controls identity_row
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where identity_row.user_id in (
  'f1190000-0000-4000-8000-000000000002',
  'f1190000-0000-4000-8000-000000000003',
  'f1190000-0000-4000-8000-000000000004',
  'f1190000-0000-4000-8000-000000000005'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator selects organisation'
);

insert into t119_ids (key, id)
select 'unit_site', public.create_organisation_unit(
  (select id from t119_ids where key = 'organisation'),
  null,
  'prod-site',
  'Production Site',
  'site'
);

insert into t119_ids (key, id)
select 'unit_other_site', public.create_organisation_unit(
  (select id from t119_ids where key = 'organisation'),
  null,
  'other-site',
  'Other Site',
  'site'
);

insert into t119_ids (key, id)
select 'unit_line1', public.create_organisation_unit(
  (select id from t119_ids where key = 'organisation'),
  (select id from t119_ids where key = 'unit_site'),
  'prod-line-1',
  'Prod Line 1',
  'line'
);

insert into t119_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from t119_ids where key = 'organisation'),
  't119-manager',
  'T119 Manager',
  'Manager for approval routing tests'
);

select ok(
  public.add_role_permission(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'manager_role'),
    'suggestions.review'
  ),
  'manager role receives suggestions.review'
);

select ok(
  public.add_role_permission(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'manager_role'),
    'suggestions.manage'
  ),
  'manager role receives suggestions.manage for override delegation retries'
);

select ok(
  public.publish_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'manager_role')
  ),
  'manager role publishes'
);

insert into t119_ids (key, id)
select
  'site_manager_grant',
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'site_manager_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  );

select ok(
  (select id from t119_ids where key = 'site_manager_grant') is not null,
  'site manager scoped to production site subtree'
);

select ok(
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'other_site_manager_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_other_site')
  ) is not null,
  'other site manager scoped to other site subtree'
);

insert into t119_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select id from t119_ids where key = 'operator_membership'),
    (select id from t119_ids where key = 'job_function'),
    true,
    (select id from t119_ids where key = 'unit_line1')
  ) is not null,
  'operator primary job assignment on prod line 1'
);

insert into t119_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into t119_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from t119_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from t119_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into t119_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into t119_ids (key, id)
select 'suggestion_draft', public.create_suggestion_draft(
  (select id from t119_ids where key = 'programme_version'),
  (select id from t119_ids where key = 'category'),
  'T119 draft must not notify',
  'Problem text',
  'Idea text',
  'Benefit text'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  0::bigint,
  'draft suggestion creates no awaiting_review notifications'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator selects organisation for submit'
);

-- Create suggestion with line origin (jurisdiction = line)
insert into t119_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from t119_ids where key = 'programme_version'),
  (select id from t119_ids where key = 'category'),
  'T119 operator line suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

update public.improvement_suggestions suggestion_row
set origin_unit_id = (select id from t119_ids where key = 'unit_line1')
where suggestion_row.id = (select id from t119_ids where key = 'suggestion')
  and suggestion_row.organisation_id = (select id from t119_ids where key = 'organisation');

select ok(
  public.submit_suggestion((select id from t119_ids where key = 'suggestion')),
  'operator submits suggestion on prod line 1'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionSubmitted'
      and outbox_row.resource_record_id = (select id from t119_ids where key = 'suggestion')
  ),
  1::bigint,
  'submit enqueues exactly one SuggestionSubmitted outbox row'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.membership_id = (select id from t119_ids where key = 'site_manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  1::bigint,
  'site-scoped production manager receives in-app approval request for line suggestion'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.membership_id = (select id from t119_ids where key = 'other_site_manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  0::bigint,
  'other site manager does not receive cross-site approval notification'
);

select ok(
  private.is_suggestion_primary_approver(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'site_manager_membership')
  ),
  'site manager is snapshotted primary approver'
);

select is(
  (
    select routing_row.notification_generation
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and routing_row.suggestion_id = (select id from t119_ids where key = 'suggestion')
  ),
  1,
  'submit snapshots notification generation 1'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator selects organisation for delegate grant'
);

insert into t119_ids (key, id)
select
  'delegate_grant',
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'delegate_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  );

select ok(
  (select id from t119_ids where key = 'delegate_grant') is not null,
  'delegate reviewer scoped to production site subtree'
);

select ok(
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'alternate_delegate_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  ) is not null,
  'alternate delegate scoped to production site subtree'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager selects organisation'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000003","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000003","email":"t119-other-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'wrong-site manager selects organisation'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'cross-site delegate'
  ),
  'approval delegation is not authorised',
  'wrong-site manager cannot delegate approval'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager returns for delegation'
);

set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'inactive',
  inactivated_at = statement_timestamp(),
  status_reason = 't119 inactive actor fixture'
where membership_row.id = (select id from t119_ids where key = 'site_manager_membership')
  and membership_row.organisation_id = (select id from t119_ids where key = 'organisation');

set local role authenticated;

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
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
where membership_row.id = (select id from t119_ids where key = 'site_manager_membership')
  and membership_row.organisation_id = (select id from t119_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'reactivated site manager for delegation'
);

reset role;
set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set
  status = 'inactive',
  inactivated_at = statement_timestamp(),
  status_reason = 't119 inactive delegate fixture'
where membership_row.id = (select id from t119_ids where key = 'delegate_membership')
  and membership_row.organisation_id = (select id from t119_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager for inactive delegate attempt'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
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
where membership_row.id = (select id from t119_ids where key = 'delegate_membership')
  and membership_row.organisation_id = (select id from t119_ids where key = 'organisation');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager for delegation'
);

insert into t119_ids (key, id)
select
  'first_delegation_assignment',
  public.delegate_suggestion_approval(
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'On leave'
  );

select ok(
  (select id from t119_ids where key = 'first_delegation_assignment') is not null,
  'pending approver delegates to eligible colleague'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'author selects organisation for delegation reason checks'
);

select is(
  public.get_suggestion_review_context(
    (select id from t119_ids where key = 'suggestion')
  )->'latest_delegation'->>'reason',
  null,
  'suggestion author does not receive delegation reason in review context'
);

select is(
  (
    select entry.value->>'reason'
    from jsonb_array_elements(
      public.get_suggestion_detail((select id from t119_ids where key = 'suggestion'))->'approval_delegations'
    ) as entry(value)
    limit 1
  ),
  null,
  'suggestion author does not receive delegation reason in detail timeline'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000004","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000004","email":"t119-delegate@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'delegate selects organisation for delegation reason checks'
);

select is(
  public.get_suggestion_review_context(
    (select id from t119_ids where key = 'suggestion')
  )->'latest_delegation'->>'reason',
  'On leave',
  'delegate sees delegation reason in review context'
);

reset role;
set local role lean_hub_private_owner;

select is(
  private.lookup_suggestion_delegation_reason_for_recipient(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership')
  ),
  'On leave',
  'email lookup returns reason for delegate recipient'
);

select is(
  private.lookup_suggestion_delegation_reason_for_recipient(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'site_manager_membership')
  ),
  null,
  'email lookup withholds reason for non-delegate recipient'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'delegating manager re-selects organisation'
);

select is(
  public.get_suggestion_review_context(
    (select id from t119_ids where key = 'suggestion')
  )->'latest_delegation'->>'reason',
  'On leave',
  'delegating manager sees delegation reason in review context'
);

select ok(
  (
    select notification_row.body
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.membership_id = (select id from t119_ids where key = 'delegate_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
    order by notification_row.created_at desc
    limit 1
  ) like '%Reason: On leave%',
  'delegation in-app notification includes reason suffix'
);

select is(
  public.delegate_suggestion_approval(
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'On leave retry'
  ),
  (select id from t119_ids where key = 'first_delegation_assignment'),
  'idempotent delegate to same target returns stable assignment id while actor retains authority'
);

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager re-selects organisation after idempotent delegate'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  private.is_suggestion_primary_approver(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'site_manager_membership')
  ),
  'primary approver unchanged while delegate holds active assignment'
);

select ok(
  private.suggestion_has_active_reviewer(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion')
  ),
  'another membership holds the sole active reviewer assignment'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager session for override delegation authority probe'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  private.can_delegate_suggestion_approval(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'site_manager_membership')
  ),
  'scoped manager override may delegate while a different active reviewer holds the claim'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000003","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000003","email":"t119-other-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'non-primary manager selects organisation for delegation denial'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'alternate_delegate_membership'),
    'non-primary parallel attempt'
  ),
  'approval delegation is not authorised',
  'non-primary manager cannot delegate while active reviewer holds claim'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator selects organisation to revoke active reviewer grant'
);

select ok(
  public.revoke_access_grant(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'delegate_grant'),
    't119 revokes delegate review grant while assignment remains'
  ),
  'operator revokes active reviewer suggestions.review grant'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000004","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000004","email":"t119-delegate@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'active reviewer after grant revocation'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'alternate_delegate_membership'),
    'revoked active reviewer hand-off'
  ),
  'approval delegation is not authorised',
  'active reviewer without review grant cannot delegate after role revocation'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000001","email":"t119-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator restores delegate review grant after revocation probe'
);

select ok(
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'delegate_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  ) is not null,
  'delegate review grant re-issued for approval path'
);

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'operator selects organisation to revoke manager review grant'
);

select ok(
  public.revoke_access_grant(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'site_manager_grant'),
    't119 revokes manager suggestions.review after delegation'
  ),
  'operator revokes site manager review grant'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000002","email":"t119-site-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'site manager after grant revocation'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'post-revocation retry'
  ),
  'approval delegation is not authorised',
  'revoked delegating actor cannot use idempotent path to bypass authority'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and assignment_row.suggestion_id = (select id from t119_ids where key = 'suggestion')
      and assignment_row.status = 'active'
  ),
  1::bigint,
  'only one active reviewer assignment remains after delegation attempts'
);

select ok(
  private.is_active_suggestion_reviewer(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership')
  ),
  'delegate remains active reviewer after parallel and revocation attempts'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.membership_id = (select id from t119_ids where key = 'site_manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  0::bigint,
  'delegation revokes prior pending approver in-app task'
);

reset role;
set local role service_role;

select is(
  (
    select coalesce(array_length(
      public.lookup_suggestion_approval_notification_recipients_for_worker(
        (select id from t119_ids where key = 'organisation'),
        (select id from t119_ids where key = 'suggestion')
      ),
      1
    ), 0)
  ),
  0::integer,
  'worker lookup suppresses stale SuggestionSubmitted email after delegation'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and notification_row.membership_id = (select id from t119_ids where key = 'delegate_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
  ),
  1::bigint,
  'delegate receives in-app approval notification'
);

select is(
  (
    select count(*)::bigint
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from t119_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewerReassigned'
      and outbox_row.resource_record_id = (select id from t119_ids where key = 'suggestion')
  ),
  1::bigint,
  'delegation enqueues reviewer reassigned email event'
);

select isnt_empty(
  $$
    select 1
    from public.suggestion_approval_delegations delegation_row
    where delegation_row.suggestion_id = (select id from t119_ids where key = 'suggestion')
      and delegation_row.to_membership_id = (select id from t119_ids where key = 'delegate_membership')
  $$,
  'delegation audit row is recorded'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000004","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000004","email":"t119-delegate@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'delegate selects organisation'
);

select throws_ok(
  format(
    'select public.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'self delegate'
  ),
  'cannot delegate approval to yourself',
  'self delegation is rejected'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1190000-0000-4000-8000-000000000004","role":"authenticated","session_id":"f1190100-0000-4000-8000-000000000004","email":"t119-delegate@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from t119_ids where key = 'organisation')),
  'delegate selects organisation to complete approval'
);

select ok(
  public.begin_suggestion_review((select id from t119_ids where key = 'suggestion')),
  'delegate begins review after assignment'
);

select ok(
  public.approve_suggestion(
    (select id from t119_ids where key = 'suggestion'),
    'medium',
    'medium',
    'Internal',
    'Approved by delegate'
  ) is not null,
  'delegate approves after manager delegation'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select suggestion_row.status
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from t119_ids where key = 'suggestion')
  ),
  'accepted',
  'suggestion ends accepted after delegate approval'
);

select * from finish();
rollback;
