begin;

select plan(89);

-- ---------------------------------------------------------------------------
-- Users and organisations
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'd4000000-0000-0000-0000-000000000001',
  's2b2-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd4000000-0000-0000-0000-000000000002',
  's2b2-reviewer@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd4000000-0000-0000-0000-000000000003',
  's2b2-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd4000000-0000-0000-0000-000000000004',
  's2b2-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd4000000-0000-0000-0000-000000000005',
  's2b2-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd4000000-0000-0000-0000-000000000006',
  's2b2-inactive@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2b2_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2b2_ids to authenticated;

insert into s2b2_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd4000000-0000-0000-0000-000000000001',
    's2b2-org',
    'S2b2 Review Context Organisation'
  )
);

insert into s2b2_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'd4000000-0000-0000-0000-000000000004',
    's2b2-other-org',
    'S2b2 Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'd4100000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'd4100000-0000-0000-0000-000000000002',
  'd4000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'd4100000-0000-0000-0000-000000000003',
  'd4000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'd4100000-0000-0000-0000-000000000004',
  'd4000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'd4100000-0000-0000-0000-000000000005',
  'd4000000-0000-0000-0000-000000000005',
  statement_timestamp(), statement_timestamp()
),
(
  'd4100000-0000-0000-0000-000000000006',
  'd4000000-0000-0000-0000-000000000006',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2b2_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2b2_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2b2_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2b2_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2b2_ids where key = 'organisation')
  and membership_row.user_id = 'd4000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2b2_ids where key = 'owner_membership'),
    (select id from s2b2_ids where key = 'job_function'),
    true,
    (select id from s2b2_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2b2_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2b2_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2b2_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2b2_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2b2_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2b2_ids (key, id)
select 'visible_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Visible portfolio suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'visible_suggestion')),
  'visible suggestion submits'
);

insert into s2b2_ids (key, id)
select 'unassigned_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Unassigned claimable suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'unassigned_suggestion')),
  'unassigned suggestion submits'
);

insert into s2b2_ids (key, id)
select 'assigned_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Assigned reviewer suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'assigned_suggestion')),
  'assigned suggestion submits'
);

insert into s2b2_ids (key, id)
select 'parked_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Parked suggestion portfolio item',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'parked_suggestion')),
  'parked suggestion submits'
);

insert into s2b2_ids (key, id)
select 'resumed_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Resumed after park suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'resumed_suggestion')),
  'resumed suggestion submits'
);

insert into s2b2_ids (key, id)
select 'under_review_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Under review suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'under_review_suggestion')),
  'under review suggestion submits'
);

insert into s2b2_ids (key, id)
select 'reassign_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Reassignment suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'reassign_suggestion')),
  'reassign suggestion submits'
);

insert into s2b2_ids (key, id)
select 'private_draft', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'programme_version'),
  (select id from s2b2_ids where key = 'category'),
  'Unreadable draft suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

-- Memberships and scoped roles
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at, display_name
  )
  values (
    (select id from s2b2_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'S2b2 Reviewer'
  )
  returning id
)
insert into s2b2_ids (key, id)
select 'reviewer_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd4000000-0000-0000-0000-000000000002';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2b2_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2b2_ids (key, id)
select 'reader_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd4000000-0000-0000-0000-000000000003';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2b2_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000005',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2b2_ids (key, id)
select 'outsider_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd4000000-0000-0000-0000-000000000005';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at, display_name
  )
  values (
    (select id from s2b2_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000006',
    'active',
    statement_timestamp(),
    'S2b2 Inactive Reviewer'
  )
  returning id
)
insert into s2b2_ids (key, id)
select 'inactive_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd4000000-0000-0000-0000-000000000006';

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner re-selects organisation for role setup'
);

insert into s2b2_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from s2b2_ids where key = 'organisation'),
  's2b2-reviewer-only',
  'S2b2 Reviewer Only',
  'Review suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2b2_ids where key = 'organisation'),
    (select id from s2b2_ids where key = 'reviewer_role'),
    'suggestions.review'
  ),
  'reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2b2_ids where key = 'organisation'),
    (select id from s2b2_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into s2b2_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from s2b2_ids where key = 'organisation'),
  (select id from s2b2_ids where key = 'reviewer_membership'),
  (select id from s2b2_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2b2_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2b2_ids where key = 'reviewer_membership'),
    (select id from s2b2_ids where key = 'job_function'),
    true,
    (select id from s2b2_ids where key = 'unit_root')
  ) is not null,
  'reviewer primary job assignment'
);

insert into s2b2_ids (key, id)
select 'inactive_reviewer_grant', public.grant_role_version(
  (select id from s2b2_ids where key = 'organisation'),
  (select id from s2b2_ids where key = 'inactive_membership'),
  (select id from s2b2_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2b2_ids where key = 'unit_root')
);

reset role;

update public.organisation_memberships membership_row
set status = 'inactive',
    inactivated_at = statement_timestamp(),
    status_reason = 'inactive for eligible reviewers exclusion test'
where membership_row.id = (select id from s2b2_ids where key = 'inactive_membership');

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);
set local role authenticated;

insert into s2b2_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from s2b2_ids where key = 'organisation'),
  's2b2-reader-only',
  'S2b2 Reader Only',
  'Read suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2b2_ids where key = 'organisation'),
    (select id from s2b2_ids where key = 'reader_role'),
    'suggestions.read'
  ),
  'reader role receives suggestions.read'
);

select ok(
  public.publish_role_version(
    (select id from s2b2_ids where key = 'organisation'),
    (select id from s2b2_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

insert into s2b2_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from s2b2_ids where key = 'organisation'),
  (select id from s2b2_ids where key = 'reader_membership'),
  (select id from s2b2_ids where key = 'reader_role'),
  'unit_subtree',
  (select id from s2b2_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2b2_ids where key = 'reader_membership'),
    (select id from s2b2_ids where key = 'job_function'),
    true,
    (select id from s2b2_ids where key = 'unit_root')
  ) is not null,
  'reader primary job assignment'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'assigned_suggestion'),
    (select id from s2b2_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to assigned suggestion'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'parked_suggestion'),
    (select id from s2b2_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to parked suggestion'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'resumed_suggestion'),
    (select id from s2b2_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to resumed suggestion'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'under_review_suggestion'),
    (select id from s2b2_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to under review suggestion'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'reassign_suggestion'),
    (select id from s2b2_ids where key = 'owner_membership')
  ) is not null,
  'owner initially assigned as reviewer for reassignment probe'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b2_ids where key = 'reassign_suggestion'),
    (select id from s2b2_ids where key = 'reviewer_membership')
  ) is not null,
  'manager reassigns reviewer for reassignment probe'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for workflow setup'
);

select ok(
  public.begin_suggestion_review((select id from s2b2_ids where key = 'parked_suggestion')),
  'reviewer begins review on parked suggestion path'
);

select ok(
  public.park_suggestion(
    (select id from s2b2_ids where key = 'parked_suggestion'),
    'Waiting for more evidence'
  ) is not null,
  'reviewer parks suggestion'
);

select ok(
  public.begin_suggestion_review((select id from s2b2_ids where key = 'resumed_suggestion')),
  'reviewer begins review on resumed suggestion path'
);

select ok(
  public.park_suggestion(
    (select id from s2b2_ids where key = 'resumed_suggestion'),
    'Paused pending supplier quote'
  ) is not null,
  'reviewer parks resumed suggestion'
);

select ok(
  public.begin_suggestion_review((select id from s2b2_ids where key = 'resumed_suggestion')),
  'reviewer resumes parked suggestion to under_review'
);

select ok(
  public.begin_suggestion_review((select id from s2b2_ids where key = 'under_review_suggestion')),
  'reviewer begins review on under review suggestion'
);

-- Cross-org suggestion (unreadable from primary org)
select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000004","email":"s2b2-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'other_organisation')),
  'other org user selects other organisation'
);

insert into s2b2_ids (key, id)
select 'other_unit', public.create_organisation_unit(
  (select id from s2b2_ids where key = 'other_organisation'),
  null,
  'other-root',
  'Other Root',
  'site'
);

insert into s2b2_ids (key, id)
select 'other_org_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2b2_ids where key = 'other_organisation')
  and membership_row.user_id = 'd4000000-0000-0000-0000-000000000004';

insert into s2b2_ids (key, id)
select 'other_job_function', public.create_job_function('Other Operator', 'other-operator');

select ok(
  public.assign_membership_job_function(
    (select id from s2b2_ids where key = 'other_org_membership'),
    (select id from s2b2_ids where key = 'other_job_function'),
    true,
    (select id from s2b2_ids where key = 'other_unit')
  ) is not null,
  'other org owner primary job assignment'
);

insert into s2b2_ids (key, id)
select 'other_programme', public.create_suggestion_programme_draft('Other Ideas', 'other-ideas');

insert into s2b2_ids (key, id)
select 'other_programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2b2_ids where key = 'other_programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2b2_ids where key = 'other_programme_version')),
  'other org programme publishes'
);

insert into s2b2_ids (key, id)
select 'other_category', public.create_suggestion_category('Other Safety', 'other-safety');

insert into s2b2_ids (key, id)
select 'cross_org_suggestion', public.create_suggestion_draft(
  (select id from s2b2_ids where key = 'other_programme_version'),
  (select id from s2b2_ids where key = 'other_category'),
  'Cross org unreadable suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b2_ids where key = 'cross_org_suggestion')),
  'cross org suggestion submits'
);

-- Reviewer cross-org membership for eligible_reviewers exclusion probe
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at, display_name
  )
  values (
    (select id from s2b2_ids where key = 'other_organisation'),
    'd4000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'S2b2 Reviewer Other Org'
  )
  returning id
)
insert into s2b2_ids (key, id)
select 'reviewer_other_org_membership', id from inserted_membership;

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000004","email":"s2b2-other-org@example.test"}',
  true
);
set local role authenticated;

insert into s2b2_ids (key, id)
select 'other_org_reviewer_role', public.create_role_draft(
  (select id from s2b2_ids where key = 'other_organisation'),
  's2b2-other-reviewer-only',
  'S2b2 Other Org Reviewer Only',
  'Review suggestions within other org subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2b2_ids where key = 'other_organisation'),
    (select id from s2b2_ids where key = 'other_org_reviewer_role'),
    'suggestions.review'
  ),
  'other org reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2b2_ids where key = 'other_organisation'),
    (select id from s2b2_ids where key = 'other_org_reviewer_role')
  ),
  'other org reviewer role publishes'
);

insert into s2b2_ids (key, id)
select 'reviewer_other_org_grant', public.grant_role_version(
  (select id from s2b2_ids where key = 'other_organisation'),
  (select id from s2b2_ids where key = 'reviewer_other_org_membership'),
  (select id from s2b2_ids where key = 'other_org_reviewer_role'),
  'unit_subtree',
  (select id from s2b2_ids where key = 'other_unit')
);

-- ---------------------------------------------------------------------------
-- A-W: get_suggestion_review_context minimum cases
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for review context probes'
);

select throws_ok(
  format(
    'select public.get_suggestion_review_context(%L::uuid)',
    (select id from s2b2_ids where key = 'cross_org_suggestion')
  ),
  'P0002',
  'suggestion not found',
  'A cross-org cannot return context'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000005","email":"s2b2-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'outsider selects organisation for unreadable draft probe'
);

select throws_ok(
  format(
    'select public.get_suggestion_review_context(%L::uuid)',
    (select id from s2b2_ids where key = 'private_draft')
  ),
  'P0002',
  'suggestion not found',
  'B unreadable suggestion cannot return context'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for readable suggestion probes'
);

select ok(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'visible_suggestion'))
    -> 'suggestion' ->> 'id'
    = (select id::text from s2b2_ids where key = 'visible_suggestion'),
  'C ordinary readable suggestion returns suggestion id'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'visible_suggestion'))
    -> 'suggestion' ->> 'title',
  'Visible portfolio suggestion',
  'C ordinary readable suggestion returns suggestion title'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'visible_suggestion'))
    -> 'suggestion' ->> 'status',
  'submitted',
  'C ordinary readable suggestion returns suggestion status'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000003","email":"s2b2-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reader selects organisation for metadata boundary probes'
);

select ok(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'visible_suggestion'))
    ->> 'reviewer' is null,
  'D ordinary reader without workflow jurisdiction does not receive reviewer identity'
);

select is(
  jsonb_array_length(
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'visible_suggestion'))
      -> 'eligible_reviewers'
  ),
  0,
  'D ordinary reader without workflow jurisdiction receives empty eligible_reviewers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for active reviewer metadata probes'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
    -> 'reviewer' ->> 'member_id',
  (select id::text from s2b2_ids where key = 'reviewer_membership'),
  'E active reviewer receives correct active reviewer member_id'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
    -> 'reviewer' ->> 'display_name',
  'S2b2 Reviewer',
  'E active reviewer receives correct active reviewer display_name'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
    -> 'reviewer' ->> 'assignment_kind',
  'assigned',
  'E active reviewer receives correct active reviewer assignment_kind'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
      -> 'reviewer' ->> 'assigned_at'
  ) is not null,
  'E active reviewer receives correct active reviewer assigned_at'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for manager metadata probes'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
    -> 'reviewer' ->> 'member_id',
  (select id::text from s2b2_ids where key = 'reviewer_membership'),
  'F manager with valid jurisdiction receives correct reviewer member_id'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
    -> 'reviewer' ->> 'display_name',
  'S2b2 Reviewer',
  'F manager with valid jurisdiction receives correct reviewer display_name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for eligible reviewers boundary probe'
);

select is(
  jsonb_array_length(
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
      -> 'eligible_reviewers'
  ),
  0,
  'G eligible_reviewers empty for caller without suggestions.manage'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for eligible reviewers enumeration probes'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
        -> 'eligible_reviewers'
    ) eligible_row
    where eligible_row ->> 'member_id' = (select id::text from s2b2_ids where key = 'reviewer_membership')
  ),
  'H eligible_reviewers includes active same-org membership with valid review jurisdiction'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
        -> 'eligible_reviewers'
    ) eligible_row
    where eligible_row ->> 'member_id' = (select id::text from s2b2_ids where key = 'inactive_membership')
  ),
  'I eligible_reviewers excludes inactive membership'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
        -> 'eligible_reviewers'
    ) eligible_row
    where eligible_row ->> 'member_id' = (select id::text from s2b2_ids where key = 'outsider_membership')
  ),
  'J eligible_reviewers excludes membership lacking review capability'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
        -> 'eligible_reviewers'
    ) eligible_row
    where eligible_row ->> 'member_id' = (select id::text from s2b2_ids where key = 'reviewer_other_org_membership')
  ),
  'K eligible_reviewers excludes cross-org membership'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for can_claim true probe'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
      -> 'permissions' ->> 'can_claim'
  )::boolean,
  'L can_claim true only for submitted unassigned authorised actor'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for can_claim false probes'
);

select ok(
  not (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
      -> 'permissions' ->> 'can_claim'
  )::boolean,
  'M can_claim false when active assignment exists'
);

select ok(
  not (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'parked_suggestion'))
      -> 'permissions' ->> 'can_claim'
  )::boolean,
  'N can_claim false for parked'
);

select ok(
  not (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'under_review_suggestion'))
      -> 'permissions' ->> 'can_claim'
  )::boolean,
  'O can_claim false for under_review'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for can_assign probes'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
      -> 'permissions' ->> 'can_assign'
  )::boolean,
  'P can_assign true for authorised manager on submitted suggestion'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'under_review_suggestion'))
      -> 'permissions' ->> 'can_assign'
  )::boolean,
  'P can_assign true for authorised manager on under_review suggestion'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'parked_suggestion'))
      -> 'permissions' ->> 'can_assign'
  )::boolean,
  'P can_assign true for authorised manager on parked suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for can_begin_review probe'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
      -> 'permissions' ->> 'can_begin_review'
  )::boolean,
  'Q can_begin_review true for active reviewer on submitted suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for manage override begin review probe'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'unassigned_suggestion'))
      -> 'permissions' ->> 'can_begin_review'
  )::boolean,
  'R can_begin_review true for manage override on unassigned submitted suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"s2b2-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'reviewer selects organisation for can_record_review probes'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'under_review_suggestion'))
      -> 'permissions' ->> 'can_record_review'
  )::boolean,
  'S can_record_review true only under_review with authorised active reviewer'
);

select ok(
  not (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'assigned_suggestion'))
      -> 'permissions' ->> 'can_record_review'
  )::boolean,
  'S can_record_review false when suggestion is not under_review'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"s2b2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b2_ids where key = 'organisation')),
  'owner selects organisation for parked and reassignment probes'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'parked_suggestion'))
      -> 'suggestion' ->> 'parked_at'
  ) is not null,
  'T parked context exposes parked_at safely'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'parked_suggestion'))
    -> 'suggestion' ->> 'parked_rationale',
  'Waiting for more evidence',
  'T parked context exposes parked_rationale safely'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'resumed_suggestion'))
    -> 'suggestion' ->> 'status',
  'under_review',
  'U resumed under_review preserves parked history with under_review status'
);

select ok(
  (
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'resumed_suggestion'))
      -> 'suggestion' ->> 'parked_at'
  ) is not null,
  'U resumed under_review preserves parked_at in suggestion object'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'resumed_suggestion'))
    -> 'suggestion' ->> 'parked_rationale',
  'Paused pending supplier quote',
  'U resumed under_review preserves parked_rationale in suggestion object'
);

select is(
  public.get_suggestion_review_context((select id from s2b2_ids where key = 'reassign_suggestion'))
    -> 'reviewer' ->> 'member_id',
  (select id::text from s2b2_ids where key = 'reviewer_membership'),
  'V historical inactive reviewer assignment does not become current reviewer after reassignment'
);

select ok(
  not exists (
    select 1
    from public.suggestion_review_assignments assignment_row
    where assignment_row.suggestion_id = (select id from s2b2_ids where key = 'reassign_suggestion')
      and assignment_row.status = 'active'
      and assignment_row.reviewer_membership_id = (select id from s2b2_ids where key = 'owner_membership')
  ),
  'V prior reviewer assignment is not active after reassignment'
);

select ok(
  jsonb_typeof(
    public.get_suggestion_review_context((select id from s2b2_ids where key = 'reassign_suggestion'))
      -> 'reviewer'
  ) = 'object',
  'W only one active reviewer represented as a single reviewer object'
);

select is(
  (
    select count(*)::integer
    from public.suggestion_review_assignments assignment_row
    where assignment_row.suggestion_id = (select id from s2b2_ids where key = 'reassign_suggestion')
      and assignment_row.status = 'active'
  ),
  1,
  'W only one active reviewer assignment exists for reassigned suggestion'
);

select * from finish();
rollback;
