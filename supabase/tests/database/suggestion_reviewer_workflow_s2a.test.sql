begin;

select plan(54);

-- ---------------------------------------------------------------------------
-- Users and organisations
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'd2000000-0000-0000-0000-000000000001',
  's2a-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd2000000-0000-0000-0000-000000000002',
  's2a-reviewer@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd2000000-0000-0000-0000-000000000003',
  's2a-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd2000000-0000-0000-0000-000000000004',
  's2a-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2a_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2a_ids to authenticated;

insert into s2a_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd2000000-0000-0000-0000-000000000001',
    's2a-org',
    'S2a Workflow Organisation'
  )
);

insert into s2a_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'd2000000-0000-0000-0000-000000000004',
    's2a-other-org',
    'S2a Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'd2100000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'd2100000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'd2100000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'd2100000-0000-0000-0000-000000000004',
  'd2000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2a_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2a_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2a_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2a_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2a_ids where key = 'organisation')
  and membership_row.user_id = 'd2000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2a_ids where key = 'owner_membership'),
    (select id from s2a_ids where key = 'job_function'),
    true,
    (select id from s2a_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2a_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2a_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2a_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2a_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2a_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2a_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from s2a_ids where key = 'programme_version'),
  (select id from s2a_ids where key = 'category'),
  'S2a workflow suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2a_ids where key = 'suggestion')),
  'suggestion submits'
);

insert into s2a_ids (key, id)
select 'unclaimed_suggestion', public.create_suggestion_draft(
  (select id from s2a_ids where key = 'programme_version'),
  (select id from s2a_ids where key = 'category'),
  'Unclaimed suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2a_ids where key = 'unclaimed_suggestion')),
  'unclaimed suggestion submits'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'suggestion')),
  'submitted',
  'submission remains submitted without auto under_review'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'active'),
  0,
  'submission does not create active reviewer assignment'
);

-- Reviewer membership and scoped review-only role
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2a_ids where key = 'organisation'),
    'd2000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2a_ids (key, id)
select 'reviewer_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd2000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);
set local role authenticated;

insert into s2a_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from s2a_ids where key = 'organisation'),
  'suggestion-reviewer-only',
  'Suggestion Reviewer Only',
  'Review suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2a_ids where key = 'organisation'),
    (select id from s2a_ids where key = 'reviewer_role'),
    'suggestions.review'
  ),
  'reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2a_ids where key = 'organisation'),
    (select id from s2a_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into s2a_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from s2a_ids where key = 'organisation'),
  (select id from s2a_ids where key = 'reviewer_membership'),
  (select id from s2a_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2a_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2a_ids where key = 'reviewer_membership'),
    (select id from s2a_ids where key = 'job_function'),
    true,
    (select id from s2a_ids where key = 'unit_root')
  ) is not null,
  'reviewer primary job assignment'
);

-- Outsider without grants
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2a_ids where key = 'organisation'),
    'd2000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2a_ids (key, id)
select 'outsider_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd2000000-0000-0000-0000-000000000003';

-- Cross-org membership (provision_organisation already created owner membership)
insert into s2a_ids (key, id)
select 'other_org_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2a_ids where key = 'other_organisation')
  and membership_row.user_id = 'd2000000-0000-0000-0000-000000000004';

-- Claim by eligible reviewer
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000002","email":"s2a-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'reviewer selects organisation'
);

insert into s2a_ids (key, id)
select 'claim_assignment', public.claim_suggestion_for_review(
  (select id from s2a_ids where key = 'suggestion')
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'active'),
  1,
  'eligible reviewer claim creates exactly one active assignment'
);

select ok(
  exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from s2a_ids where key = 'suggestion')
  ),
  'active reviewer gains temporary suggestion read access'
);

select throws_ok(
  format(
    'select public.claim_suggestion_for_review(%L::uuid)',
    (select id from s2a_ids where key = 'suggestion')
  ),
  '55000',
  'suggestion already has an active reviewer',
  'second claim attempt is rejected'
);

-- Ineligible outsider cannot claim
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000003","email":"s2a-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'outsider selects organisation'
);

select throws_ok(
  format(
    'select public.claim_suggestion_for_review(%L::uuid)',
    (select id from s2a_ids where key = 'unclaimed_suggestion')
  ),
  '42501',
  'suggestion claim is not authorised',
  'ineligible user cannot claim suggestion'
);

-- Cross-tenant user cannot claim
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000004","email":"s2a-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'other_organisation')),
  'cross-tenant user selects other organisation'
);

select throws_ok(
  format(
    'select public.claim_suggestion_for_review(%L::uuid)',
    (select id from s2a_ids where key = 'suggestion')
  ),
  'P0002',
  'suggestion not found',
  'cross-tenant user cannot claim foreign suggestion'
);

-- Database uniqueness invariant for active assignments
select throws_ok(
  format(
    $sql$
      insert into public.suggestion_review_assignments (
        organisation_id, suggestion_id, reviewer_membership_id, assigned_by_membership_id, assignment_kind
      ) values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'assigned'
      )
    $sql$,
    (select id from s2a_ids where key = 'organisation'),
    (select id from s2a_ids where key = 'suggestion'),
    (select id from s2a_ids where key = 'outsider_membership'),
    (select id from s2a_ids where key = 'owner_membership')
  ),
  '23505',
  null,
  'partial unique index prevents two active reviewer assignments'
);

-- Manager assign / reassign
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'owner selects organisation for assignment'
);

insert into s2a_ids (key, id)
select 'reassign_assignment', public.assign_suggestion_reviewer(
  (select id from s2a_ids where key = 'suggestion'),
  (select id from s2a_ids where key = 'owner_membership')
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'active'),
  1,
  'reassignment leaves exactly one active reviewer'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'completed'),
  1,
  'reassignment preserves prior assignment history'
);

select is(
  (select reviewer_membership_id
   from public.suggestion_review_assignments assignment_row
   where assignment_row.id = (select id from s2a_ids where key = 'reassign_assignment')),
  (select id from s2a_ids where key = 'owner_membership'),
  'reassignment activates the new reviewer'
);

select throws_ok(
  format(
    'select public.assign_suggestion_reviewer(%L::uuid, %L::uuid)',
    (select id from s2a_ids where key = 'suggestion'),
    (select id from s2a_ids where key = 'outsider_membership')
  ),
  '42501',
  'target reviewer lacks review capability for jurisdiction',
  'ineligible reviewer target is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000003","email":"s2a-outsider@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.assign_suggestion_reviewer(%L::uuid, %L::uuid)',
    (select id from s2a_ids where key = 'suggestion'),
    (select id from s2a_ids where key = 'reviewer_membership')
  ),
  '42501',
  'reviewer assignment is not authorised',
  'unauthorised caller cannot assign reviewer'
);

-- Begin review requires active reviewer authority
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  public.begin_suggestion_review((select id from s2a_ids where key = 'suggestion')),
  'active reviewer can begin review'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'suggestion')),
  'under_review',
  'begin review transitions suggestion to under_review'
);

-- Superseded reviewer cannot decide
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000002","email":"s2a-reviewer@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.approve_suggestion(%L::uuid, %L, %L, %L, %L)',
    (select id from s2a_ids where key = 'suggestion'),
    'medium',
    'low',
    'Superseded reviewer attempted approval',
    'Please revise the proposal before approval.'
  ),
  '42501',
  'review recording is not authorised',
  'superseded reviewer cannot approve'
);

-- Active reviewer decisions
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  public.park_suggestion(
    (select id from s2a_ids where key = 'suggestion'),
    'Internal: waiting for additional operational data',
    'medium',
    'medium',
    'Waiting for additional operational data'
  ) is not null,
  'active reviewer can park with rationale'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'suggestion')),
  'parked',
  'park transitions suggestion to parked'
);

select is(
  (select parked_rationale from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'suggestion')),
  'Waiting for additional operational data',
  'parked rationale is stored durably'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'active'),
  1,
  'park retains active reviewer assignment'
);

select throws_ok(
  format(
    'select public.park_suggestion(%L::uuid, %L)',
    (select id from s2a_ids where key = 'suggestion'),
    '   '
  ),
  '22023',
  'parked suggestions require a rationale',
  'park without rationale is rejected'
);

select ok(
  public.begin_suggestion_review((select id from s2a_ids where key = 'suggestion')),
  'parked suggestion can resume review'
);

select ok(
  public.decline_suggestion(
    (select id from s2a_ids where key = 'suggestion'),
    'medium',
    'low',
    'Declined after resumed review',
    'This suggestion is not feasible in the current cycle.'
  ) is not null,
  'active reviewer can decline'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'suggestion')),
  'rejected',
  'decline transitions suggestion to rejected'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'suggestion')
     and assignment_row.status = 'active'),
  0,
  'decline ends active reviewer assignment'
);

-- Approve path on a fresh submitted suggestion
insert into s2a_ids (key, id)
select 'approve_suggestion', public.create_suggestion_draft(
  (select id from s2a_ids where key = 'programme_version'),
  (select id from s2a_ids where key = 'category'),
  'Approve path suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2a_ids where key = 'approve_suggestion')),
  'second suggestion submits'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2a_ids where key = 'approve_suggestion'),
    (select id from s2a_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer for approve path'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000002","email":"s2a-reviewer@example.test"}',
  true
);

select ok(
  exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from s2a_ids where key = 'approve_suggestion')
  ),
  'assigned reviewer gains temporary read access before decision'
);

select ok(
  public.begin_suggestion_review((select id from s2a_ids where key = 'approve_suggestion')),
  'assigned reviewer begins review for approve path'
);

select ok(
  public.approve_suggestion(
    (select id from s2a_ids where key = 'approve_suggestion'),
    'high',
    'medium',
    'Approved for implementation',
    'Great idea — proceed to implementation.'
  ) is not null,
  'active reviewer can approve'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from s2a_ids where key = 'approve_suggestion')),
  'accepted',
  'approve transitions suggestion to accepted'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from s2a_ids where key = 'approve_suggestion')
     and assignment_row.status = 'active'),
  0,
  'approve ends active reviewer assignment'
);

-- Reviewer-only visibility ends after assignment is superseded
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'owner selects organisation for visibility probe'
);

insert into s2a_ids (key, id)
select 'visibility_suggestion', public.create_suggestion_draft(
  (select id from s2a_ids where key = 'programme_version'),
  (select id from s2a_ids where key = 'category'),
  'Visibility suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2a_ids where key = 'visibility_suggestion')),
  'visibility suggestion submits'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2a_ids where key = 'visibility_suggestion'),
    (select id from s2a_ids where key = 'reviewer_membership')
  ) is not null,
  'reviewer receives temporary assignment for visibility probe'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000002","email":"s2a-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2a_ids where key = 'organisation')),
  'reviewer selects organisation for visibility probe'
);

select ok(
  private.can_read_improvement_suggestion(
    (select id from s2a_ids where key = 'organisation'),
    (select id from s2a_ids where key = 'visibility_suggestion')
  ),
  'active reviewer has temporary suggestion read access'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2a_ids where key = 'visibility_suggestion'),
    (select id from s2a_ids where key = 'owner_membership')
  ) is not null,
  'manager reassign ends prior reviewer temporary access'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000002","email":"s2a-reviewer@example.test"}',
  true
);

select ok(
  not private.can_read_improvement_suggestion(
    (select id from s2a_ids where key = 'organisation'),
    (select id from s2a_ids where key = 'visibility_suggestion')
  ),
  'reviewer-only visibility ends after assignment completion'
);

-- Ordinary scope-based reader retains access
select set_config(
  'request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2100000-0000-0000-0000-000000000001","email":"s2a-owner@example.test"}',
  true
);

select ok(
  exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from s2a_ids where key = 'approve_suggestion')
  ),
  'ordinary scope-based reader retains suggestion access'
);

select throws_ok(
  format(
    'select public.approve_suggestion(%L::uuid, %L, %L, %L, %L)',
    (select id from s2a_ids where key = 'approve_suggestion'),
    'high',
    'low',
    'Invalid transition from accepted',
    'This should not be approved again.'
  ),
  '55000',
  'suggestion is not under review',
  'invalid workflow transition is rejected'
);

select ok(
  public.get_suggestions_list(null, null, 1, 25) -> 'items' is not null,
  'S3a-compatible suggestions list remains available'
);

select * from finish();
rollback;
