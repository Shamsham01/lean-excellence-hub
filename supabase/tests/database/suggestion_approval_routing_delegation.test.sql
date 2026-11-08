begin;

select plan(24);

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
  ('f1190000-0000-4000-8000-000000000004'::uuid)
) as user_row(id);

insert into t119_ids (key, id)
select key, membership_row.id
from (
  values
    ('site_manager_membership', 'f1190000-0000-4000-8000-000000000002'::uuid),
    ('other_site_manager_membership', 'f1190000-0000-4000-8000-000000000003'::uuid),
    ('delegate_membership', 'f1190000-0000-4000-8000-000000000004'::uuid)
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
  'f1190000-0000-4000-8000-000000000004'
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
  public.publish_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'manager_role')
  ),
  'manager role publishes'
);

select ok(
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'site_manager_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  ) is not null,
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
  private.is_suggestion_pending_approver(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'site_manager_membership')
  ),
  'site manager is deterministic pending approver'
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

select ok(
  public.grant_role_version(
    (select id from t119_ids where key = 'organisation'),
    (select id from t119_ids where key = 'delegate_membership'),
    (select id from t119_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from t119_ids where key = 'unit_site')
  ) is not null,
  'delegate reviewer scoped to production site subtree'
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

select ok(
  public.delegate_suggestion_approval(
    (select id from t119_ids where key = 'suggestion'),
    (select id from t119_ids where key = 'delegate_membership'),
    'On leave'
  ) is not null,
  'pending approver delegates to eligible colleague'
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

select * from finish();
rollback;
