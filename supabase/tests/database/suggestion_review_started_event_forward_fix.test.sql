begin;

select plan(26);

-- ---------------------------------------------------------------------------
-- Users and organisations
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'f3000000-0000-0000-0000-000000000001',
  's2d-event-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f3000000-0000-0000-0000-000000000002',
  's2d-event-reviewer@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f3000000-0000-0000-0000-000000000003',
  's2d-event-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f3000000-0000-0000-0000-000000000004',
  's2d-event-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2d_event_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2d_event_ids to authenticated, lean_hub_private_owner;

insert into s2d_event_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f3000000-0000-0000-0000-000000000001',
    's2d-event-org',
    'S2d Review Started Event Organisation'
  )
);

insert into s2d_event_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'f3000000-0000-0000-0000-000000000004',
    's2d-event-other-org',
    'S2d Review Started Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'f3100000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'f3100000-0000-0000-0000-000000000002',
  'f3000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'f3100000-0000-0000-0000-000000000003',
  'f3000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'f3100000-0000-0000-0000-000000000004',
  'f3000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000001","email":"s2d-event-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2d_event_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2d_event_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2d_event_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2d_event_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2d_event_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
  and membership_row.user_id = 'f3000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2d_event_ids where key = 'owner_membership'),
    (select id from s2d_event_ids where key = 'job_function'),
    true,
    (select id from s2d_event_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2d_event_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2d_event_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2d_event_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2d_event_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2d_event_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2d_event_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from s2d_event_ids where key = 'programme_version'),
  (select id from s2d_event_ids where key = 'category'),
  'S2d review started event suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2d_event_ids where key = 'suggestion')),
  'suggestion submits'
);

-- Reviewer membership and scoped review-only role
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2d_event_ids where key = 'organisation'),
    'f3000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2d_event_ids (key, id)
select 'reviewer_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'f3000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000001","email":"s2d-event-owner@example.test"}',
  true
);
set local role authenticated;

insert into s2d_event_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from s2d_event_ids where key = 'organisation'),
  'suggestion-reviewer-only',
  'Suggestion Reviewer Only',
  'Review suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2d_event_ids where key = 'organisation'),
    (select id from s2d_event_ids where key = 'reviewer_role'),
    'suggestions.review'
  ),
  'reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2d_event_ids where key = 'organisation'),
    (select id from s2d_event_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into s2d_event_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from s2d_event_ids where key = 'organisation'),
  (select id from s2d_event_ids where key = 'reviewer_membership'),
  (select id from s2d_event_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2d_event_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2d_event_ids where key = 'reviewer_membership'),
    (select id from s2d_event_ids where key = 'job_function'),
    true,
    (select id from s2d_event_ids where key = 'unit_root')
  ) is not null,
  'reviewer primary job assignment'
);

-- Outsider without review authority
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2d_event_ids where key = 'organisation'),
    'f3000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2d_event_ids (key, id)
select 'outsider_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'f3000000-0000-0000-0000-000000000003';

-- Claim by eligible reviewer
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000002","email":"s2d-event-reviewer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2d_event_ids where key = 'organisation')),
  'reviewer selects organisation'
);

select ok(
  public.claim_suggestion_for_review((select id from s2d_event_ids where key = 'suggestion')) is not null,
  'eligible reviewer claims suggestion'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::integer
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
  ),
  0,
  'no review-started event exists before begin review'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000002","email":"s2d-event-reviewer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.begin_suggestion_review((select id from s2d_event_ids where key = 'suggestion')),
  'active reviewer can begin review'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2d_event_ids where key = 'suggestion')),
  'under_review',
  'begin review transitions suggestion to under_review'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::integer
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  1,
  'successful begin review emits exactly one SuggestionReviewStarted event'
);

select is(
  (
    select outbox_row.organisation_id
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  (select id from s2d_event_ids where key = 'organisation'),
  'review-started event organisation_id is correct'
);

select is(
  (
    select outbox_row.payload
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  '{}'::jsonb,
  'review-started event payload is empty object'
);

select is(
  (
    select outbox_row.idempotency_key
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  'SuggestionReviewStarted:' || (select id::text from s2d_event_ids where key = 'suggestion'),
  'review-started idempotency key is event-qualified suggestion id'
);

-- Unauthorized begin review emits nothing
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000001","email":"s2d-event-owner@example.test"}',
  true
);
set local role authenticated;

insert into s2d_event_ids (key, id)
select 'unclaimed_suggestion', public.create_suggestion_draft(
  (select id from s2d_event_ids where key = 'programme_version'),
  (select id from s2d_event_ids where key = 'category'),
  'Unclaimed suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2d_event_ids where key = 'unclaimed_suggestion')),
  'unclaimed suggestion submits'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000003","email":"s2d-event-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2d_event_ids where key = 'organisation')),
  'outsider selects organisation'
);

select throws_ok(
  format(
    'select public.begin_suggestion_review(%L::uuid)',
    (select id from s2d_event_ids where key = 'unclaimed_suggestion')
  ),
  '42501',
  'review start is not authorised',
  'unauthorised member cannot begin review'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2d_event_ids where key = 'unclaimed_suggestion')),
  'submitted',
  'unauthorised begin review leaves suggestion status unchanged'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::integer
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'unclaimed_suggestion')
  ),
  0,
  'unauthorised begin review emits no review-started event'
);

-- Invalid lifecycle emits nothing
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000002","email":"s2d-event-reviewer@example.test"}',
  true
);
set local role authenticated;

select throws_ok(
  format(
    'select public.begin_suggestion_review(%L::uuid)',
    (select id from s2d_event_ids where key = 'suggestion')
  ),
  '55000',
  'suggestion is not reviewable',
  'begin review from under_review is rejected'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::integer
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  1,
  'invalid lifecycle retry does not create duplicate review-started event'
);

-- Tenant isolation: cross-organisation begin review cannot emit into another tenant
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"f3100000-0000-0000-0000-000000000004","email":"s2d-event-other-org@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2d_event_ids where key = 'other_organisation')),
  'cross-tenant user selects other organisation'
);

select throws_ok(
  format(
    'select public.begin_suggestion_review(%L::uuid)',
    (select id from s2d_event_ids where key = 'suggestion')
  ),
  'P0002',
  'suggestion not found',
  'cross-tenant begin review is rejected'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::integer
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = (select id from s2d_event_ids where key = 'organisation')
      and outbox_row.event_type = 'SuggestionReviewStarted'
      and outbox_row.resource_record_id = (select id from s2d_event_ids where key = 'suggestion')
  ),
  1,
  'cross-tenant begin review attempt does not emit event into target organisation'
);

select * from finish();
rollback;
