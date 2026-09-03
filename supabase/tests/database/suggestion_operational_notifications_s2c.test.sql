begin;

select plan(29);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'e2000000-0000-0000-0000-000000000001',
  's2c-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e2000000-0000-0000-0000-000000000002',
  's2c-reviewer@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e2000000-0000-0000-0000-000000000003',
  's2c-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e2000000-0000-0000-0000-000000000004',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2c_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on s2c_ids to service_role, lean_hub_private_owner, authenticated;

insert into s2c_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e2000000-0000-0000-0000-000000000001',
    's2c-org',
    'S2c Notification Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'e2100000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'e2100000-0000-0000-0000-000000000002',
  'e2000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2c_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2c_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2c_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2c_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2c_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2c_ids where key = 'organisation')
  and membership_row.user_id = 'e2000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2c_ids where key = 'owner_membership'),
    (select id from s2c_ids where key = 'job_function'),
    true,
    (select id from s2c_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2c_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2c_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2c_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2c_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2c_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2c_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from s2c_ids where key = 'programme_version'),
  (select id from s2c_ids where key = 'category'),
  'S2c notification suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2c_ids where key = 'suggestion')),
  'suggestion submits'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2c_ids where key = 'organisation'),
    'e2000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2c_ids (key, id)
select 'reviewer_membership', inserted_membership.id
from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'e2000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

insert into s2c_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from s2c_ids where key = 'organisation'),
  's2c-reviewer-only',
  'S2c Reviewer Only',
  'Review suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'reviewer_role'),
    'suggestions.review'
  ),
  'reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into s2c_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from s2c_ids where key = 'organisation'),
  (select id from s2c_ids where key = 'reviewer_membership'),
  (select id from s2c_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2c_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2c_ids where key = 'reviewer_membership'),
    (select id from s2c_ids where key = 'job_function'),
    true,
    (select id from s2c_ids where key = 'unit_root')
  ) is not null,
  'reviewer primary job assignment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2c_ids where key = 'organisation')),
  'owner reselects organisation for reviewer assignment'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'reviewer_membership')
  ) is not null,
  'reviewer assignment created'
);

reset role;
set local role lean_hub_private_owner;

insert into s2c_ids (key, id)
select
  'assigned_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionReviewerAssigned',
    's2c-assigned-event',
    jsonb_build_object(
      'reviewer_membership_id',
      (select id::text from s2c_ids where key = 'reviewer_membership')
    )
  );

insert into s2c_ids (key, id)
select
  'assigned_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'assigned_event'),
    (select id from s2c_ids where key = 'reviewer_membership'),
    'suggestions.reviewer_assigned',
    's2c-assigned-delivery-key'
  );

insert into s2c_ids (key, id)
select
  'review_started_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionReviewStarted',
    's2c-review-started-event',
    '{}'::jsonb
  );

insert into s2c_ids (key, id)
select
  'review_started_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'review_started_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.review_started',
    's2c-review-started-delivery-key'
  );

reset role;
set local role service_role;

select ok(
  exists (
    select 1
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'assigned_delivery'),
      (select id from s2c_ids where key = 'assigned_event')
    ) context_row
    where context_row.recipient_resolution_status = 'deliverable'
      and context_row.context_detail = 'Assigned to you for review'
      and context_row.context_link_path =
        '/platform/suggestions/review?queue=mine&suggestionId='
        || (select id::text from s2c_ids where key = 'suggestion')
  ),
  'A/D: current reviewer receives assignment context in same organisation'
);

select is(
  (
    select count(*)::integer
    from public.get_notification_delivery_context_for_worker(
      gen_random_uuid(),
      (select id from s2c_ids where key = 'assigned_delivery'),
      (select id from s2c_ids where key = 'assigned_event')
    )
  ),
  0,
  'J: cross-org recipient fails closed for reviewer assignment'
);

select ok(
  exists (
    select 1
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'review_started_delivery'),
      (select id from s2c_ids where key = 'review_started_event')
    ) context_row
    where context_row.recipient_resolution_status = 'deliverable'
      and context_row.context_detail = 'Your suggestion is now under review'
      and context_row.context_link_path =
        '/platform/suggestions/' || (select id::text from s2c_ids where key = 'suggestion')
  ),
  'E: author review-start notification resolves to canonical author'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'owner_membership')
  ) is not null,
  'reviewer reassigned away from original reviewer'
);

reset role;
set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'assigned_delivery'),
      (select id from s2c_ids where key = 'assigned_event')
    ) context_row
  ),
  'not_authorized',
  'B/C: reassigned-away reviewer becomes not_authorized'
);

set local role lean_hub_private_owner;

insert into s2c_ids (key, id)
select
  'approved_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionAccepted',
    's2c-approved-event',
    jsonb_build_object('decision', 'accept')
  );

insert into s2c_ids (key, id)
select
  'approved_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'approved_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.approved',
    's2c-approved-delivery-key'
  );

insert into s2c_ids (key, id)
select
  'declined_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionRejected',
    's2c-declined-event',
    jsonb_build_object('decision', 'reject')
  );

insert into s2c_ids (key, id)
select
  'declined_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'declined_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.declined',
    's2c-declined-delivery-key'
  );

insert into s2c_ids (key, id)
select
  'parked_event',
  private.enqueue_domain_event(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    'SuggestionParked',
    's2c-parked-event',
    jsonb_build_object('decision', 'park')
  );

insert into s2c_ids (key, id)
select
  'parked_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'parked_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.parked',
    's2c-parked-delivery-key'
  );

insert into s2c_ids (key, id)
select
  'wrong_author_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'approved_event'),
    (select id from s2c_ids where key = 'reviewer_membership'),
    'suggestions.approved',
    's2c-wrong-author-delivery-key'
  );

reset role;
set local role service_role;

select is(
  (
    select context_row.context_detail
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'approved_delivery'),
      (select id from s2c_ids where key = 'approved_event')
    ) context_row
  ),
  'Your suggestion was approved',
  'F: author approved notification context'
);

select is(
  (
    select context_row.context_detail
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'declined_delivery'),
      (select id from s2c_ids where key = 'declined_event')
    ) context_row
  ),
  'Your suggestion was declined',
  'G: author declined notification context'
);

select is(
  (
    select context_row.context_detail
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'parked_delivery'),
      (select id from s2c_ids where key = 'parked_event')
    ) context_row
  ),
  'Your suggestion was parked for further consideration',
  'H: author parked notification context'
);

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'wrong_author_delivery'),
      (select id from s2c_ids where key = 'approved_event')
    ) context_row
  ),
  'not_authorized',
  'I: wrong author membership cannot receive lifecycle context'
);

set local role lean_hub_private_owner;

update public.organisation_memberships membership_row
set status = 'inactive',
    inactivated_at = statement_timestamp(),
    status_reason = 'test inactivation'
where membership_row.id = (select id from s2c_ids where key = 'reviewer_membership');

insert into s2c_ids (key, id)
select
  'inactive_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'assigned_event'),
    (select id from s2c_ids where key = 'reviewer_membership'),
    'suggestions.reviewer_assigned',
    's2c-inactive-delivery-key'
  );

reset role;
set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'inactive_delivery'),
      (select id from s2c_ids where key = 'assigned_event')
    ) context_row
  ),
  'inactive_membership',
  'K: inactive membership remains non-deliverable'
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
  (select id from s2c_ids where key = 'organisation'),
  'e2000000-0000-0000-0000-000000000003',
  'Disabled Workforce',
  'active',
  statement_timestamp()
);

insert into private.workforce_accounts (
  user_id,
  internal_login_identifier,
  status
)
values (
  'e2000000-0000-0000-0000-000000000003',
  'disabled-workforce@workforce.invalid',
  'disabled'
);

insert into s2c_ids (key, id)
select 'disabled_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'e2000000-0000-0000-0000-000000000003'
  and membership_row.organisation_id = (select id from s2c_ids where key = 'organisation');

insert into s2c_ids (key, id)
select
  'disabled_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'review_started_event'),
    (select id from s2c_ids where key = 'disabled_membership'),
    'suggestions.review_started',
    's2c-disabled-delivery-key'
  );

insert into public.membership_notification_contacts (
  organisation_id,
  membership_id,
  channel_type,
  contact_address,
  status,
  source
)
values (
  (select id from s2c_ids where key = 'organisation'),
  (select id from s2c_ids where key = 'owner_membership'),
  'email',
  'not-an-email',
  'active',
  'manual'
);

insert into s2c_ids (key, id)
select
  'invalid_contact_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'review_started_event'),
    (select id from s2c_ids where key = 'owner_membership'),
    'suggestions.review_started',
    's2c-invalid-contact-delivery-key'
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  display_name,
  status,
  activated_at
)
values (
  (select id from s2c_ids where key = 'organisation'),
  'e2000000-0000-0000-0000-000000000004',
  'Synthetic Workforce',
  'active',
  statement_timestamp()
);

insert into private.workforce_accounts (
  user_id,
  internal_login_identifier,
  status
)
values (
  'e2000000-0000-0000-0000-000000000004',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid',
  'active'
);

insert into s2c_ids (key, id)
select 'synthetic_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'e2000000-0000-0000-0000-000000000004'
  and membership_row.organisation_id = (select id from s2c_ids where key = 'organisation');

insert into s2c_ids (key, id)
select
  'synthetic_delivery',
  private.create_notification_delivery(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'review_started_event'),
    (select id from s2c_ids where key = 'synthetic_membership'),
    'suggestions.review_started',
    's2c-synthetic-delivery-key'
  );

reset role;
set local role service_role;

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'disabled_delivery'),
      (select id from s2c_ids where key = 'review_started_event')
    ) context_row
  ),
  'disabled_workforce_account',
  'L: disabled workforce account remains non-deliverable'
);

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'invalid_contact_delivery'),
      (select id from s2c_ids where key = 'review_started_event')
    ) context_row
  ),
  'invalid_email',
  'N: invalid contact remains blocked'
);

select is(
  (
    select context_row.recipient_resolution_status
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'synthetic_delivery'),
      (select id from s2c_ids where key = 'review_started_event')
    ) context_row
  ),
  'synthetic_auth_email',
  'M: workforce.invalid remains blocked'
);

select ok(
  exists (
    select 1
    from public.get_notification_delivery_context_for_worker(
      (select id from s2c_ids where key = 'organisation'),
      (select id from s2c_ids where key = 'assigned_delivery'),
      (select id from s2c_ids where key = 'assigned_event')
    ) context_row
    where context_row.context_title is not null
  ),
  'O: suggestion context resolves without breaking existing delivery kinds'
);

select ok(
  to_regprocedure(
    'public.lookup_suggestion_author_membership_id_for_worker(uuid,uuid)'
  ) is not null,
  'author lookup RPC exists for trusted worker'
);

select is(
  public.lookup_suggestion_author_membership_id_for_worker(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion')
  ),
  (select id from s2c_ids where key = 'owner_membership'),
  'author lookup returns canonical author membership'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2100000-0000-0000-0000-000000000001","email":"s2c-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2c_ids where key = 'organisation')),
  'owner selects organisation for membership read equivalence probe'
);

select ok(
  private.can_read_improvement_suggestion(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion')
  ),
  'Q: refactored can_read_improvement_suggestion remains true for owner scope reader'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  private.membership_can_read_improvement_suggestion(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'owner_membership')
  ),
  'Q: membership-specific read helper matches owner visibility'
);

select ok(
  not private.membership_can_read_improvement_suggestion(
    (select id from s2c_ids where key = 'organisation'),
    (select id from s2c_ids where key = 'suggestion'),
    (select id from s2c_ids where key = 'reviewer_membership')
  ),
  'Q: ended reviewer no longer has membership-specific read access'
);

select * from finish();

rollback;
