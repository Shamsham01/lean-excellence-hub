begin;

select plan(81);

-- ---------------------------------------------------------------------------
-- Users and organisations
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'd3000000-0000-0000-0000-000000000001',
  's2b1-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd3000000-0000-0000-0000-000000000002',
  's2b1-reviewer@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd3000000-0000-0000-0000-000000000003',
  's2b1-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd3000000-0000-0000-0000-000000000004',
  's2b1-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'd3000000-0000-0000-0000-000000000005',
  's2b1-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table s2b1_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on s2b1_ids to authenticated;

insert into s2b1_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd3000000-0000-0000-0000-000000000001',
    's2b1-org',
    'S2b1 Query Organisation'
  )
);

insert into s2b1_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'd3000000-0000-0000-0000-000000000004',
    's2b1-other-org',
    'S2b1 Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'd3100000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'd3100000-0000-0000-0000-000000000002',
  'd3000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'd3100000-0000-0000-0000-000000000003',
  'd3000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'd3100000-0000-0000-0000-000000000004',
  'd3000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'd3100000-0000-0000-0000-000000000005',
  'd3000000-0000-0000-0000-000000000005',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into s2b1_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from s2b1_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into s2b1_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into s2b1_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2b1_ids where key = 'organisation')
  and membership_row.user_id = 'd3000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from s2b1_ids where key = 'owner_membership'),
    (select id from s2b1_ids where key = 'job_function'),
    true,
    (select id from s2b1_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into s2b1_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into s2b1_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2b1_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2b1_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into s2b1_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into s2b1_ids (key, id)
select 'visible_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Visible portfolio suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'visible_suggestion')),
  'visible suggestion submits'
);

insert into s2b1_ids (key, id)
select 'unassigned_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Unassigned claimable suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'unassigned_suggestion')),
  'unassigned suggestion submits'
);

insert into s2b1_ids (key, id)
select 'assigned_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Assigned reviewer suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'assigned_suggestion')),
  'assigned suggestion submits'
);

insert into s2b1_ids (key, id)
select 'parked_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Parked suggestion portfolio item',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'parked_suggestion')),
  'parked suggestion submits'
);

insert into s2b1_ids (key, id)
select 'search_percent', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Literal percent % title',
  'Problem text',
  'Idea text',
  'Benefit text'
);

insert into s2b1_ids (key, id)
select 'search_underscore', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Literal underscore _ title',
  'Problem text',
  'Idea text',
  'Benefit text'
);

insert into s2b1_ids (key, id)
select 'search_backslash', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  E'Literal backslash \\ title',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'search_percent')),
  'percent search suggestion submits'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'search_underscore')),
  'underscore search suggestion submits'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'search_backslash')),
  'backslash search suggestion submits'
);

insert into s2b1_ids (key, id)
select 'private_draft', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Unreadable draft suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

-- Reviewer membership and scoped review role
reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at, display_name
  )
  values (
    (select id from s2b1_ids where key = 'organisation'),
    'd3000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'S2b1 Reviewer'
  )
  returning id
)
insert into s2b1_ids (key, id)
select 'reviewer_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd3000000-0000-0000-0000-000000000002';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2b1_ids where key = 'organisation'),
    'd3000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2b1_ids (key, id)
select 'reader_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd3000000-0000-0000-0000-000000000003';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from s2b1_ids where key = 'organisation'),
    'd3000000-0000-0000-0000-000000000005',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into s2b1_ids (key, id)
select 'outsider_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'd3000000-0000-0000-0000-000000000005';

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner re-selects organisation for role setup'
);

insert into s2b1_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from s2b1_ids where key = 'organisation'),
  's2b1-reviewer-only',
  'S2b1 Reviewer Only',
  'Review suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2b1_ids where key = 'organisation'),
    (select id from s2b1_ids where key = 'reviewer_role'),
    'suggestions.review'
  ),
  'reviewer role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from s2b1_ids where key = 'organisation'),
    (select id from s2b1_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into s2b1_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from s2b1_ids where key = 'organisation'),
  (select id from s2b1_ids where key = 'reviewer_membership'),
  (select id from s2b1_ids where key = 'reviewer_role'),
  'unit_subtree',
  (select id from s2b1_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2b1_ids where key = 'reviewer_membership'),
    (select id from s2b1_ids where key = 'job_function'),
    true,
    (select id from s2b1_ids where key = 'unit_root')
  ) is not null,
  'reviewer primary job assignment'
);

insert into s2b1_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from s2b1_ids where key = 'organisation'),
  's2b1-reader-only',
  'S2b1 Reader Only',
  'Read suggestions within subtree only'
);

select ok(
  public.add_role_permission(
    (select id from s2b1_ids where key = 'organisation'),
    (select id from s2b1_ids where key = 'reader_role'),
    'suggestions.read'
  ),
  'reader role receives suggestions.read'
);

select ok(
  public.publish_role_version(
    (select id from s2b1_ids where key = 'organisation'),
    (select id from s2b1_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

insert into s2b1_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from s2b1_ids where key = 'organisation'),
  (select id from s2b1_ids where key = 'reader_membership'),
  (select id from s2b1_ids where key = 'reader_role'),
  'unit_subtree',
  (select id from s2b1_ids where key = 'unit_root')
);

select ok(
  public.assign_membership_job_function(
    (select id from s2b1_ids where key = 'reader_membership'),
    (select id from s2b1_ids where key = 'job_function'),
    true,
    (select id from s2b1_ids where key = 'unit_root')
  ) is not null,
  'reader primary job assignment'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b1_ids where key = 'assigned_suggestion'),
    (select id from s2b1_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to assigned suggestion'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b1_ids where key = 'parked_suggestion'),
    (select id from s2b1_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer to parked suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'reviewer selects organisation'
);

select ok(
  public.begin_suggestion_review((select id from s2b1_ids where key = 'parked_suggestion')),
  'reviewer begins review on parked suggestion path'
);

select ok(
  public.park_suggestion(
    (select id from s2b1_ids where key = 'parked_suggestion'),
    'Internal: waiting for more evidence',
    'medium',
    'medium',
    'Waiting for more evidence'
  ) is not null,
  'reviewer parks suggestion'
);

-- Cross-org suggestion (unreadable from primary org)
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000004","email":"s2b1-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'other_organisation')),
  'other org user selects other organisation'
);

insert into s2b1_ids (key, id)
select 'other_unit', public.create_organisation_unit(
  (select id from s2b1_ids where key = 'other_organisation'),
  null,
  'other-root',
  'Other Root',
  'site'
);

insert into s2b1_ids (key, id)
select 'other_org_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from s2b1_ids where key = 'other_organisation')
  and membership_row.user_id = 'd3000000-0000-0000-0000-000000000004';

insert into s2b1_ids (key, id)
select 'other_job_function', public.create_job_function('Other Operator', 'other-operator');

select ok(
  public.assign_membership_job_function(
    (select id from s2b1_ids where key = 'other_org_membership'),
    (select id from s2b1_ids where key = 'other_job_function'),
    true,
    (select id from s2b1_ids where key = 'other_unit')
  ) is not null,
  'other org owner primary job assignment'
);

insert into s2b1_ids (key, id)
select 'other_programme', public.create_suggestion_programme_draft('Other Ideas', 'other-ideas');

insert into s2b1_ids (key, id)
select 'other_programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from s2b1_ids where key = 'other_programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from s2b1_ids where key = 'other_programme_version')),
  'other org programme publishes'
);

insert into s2b1_ids (key, id)
select 'other_category', public.create_suggestion_category('Other Safety', 'other-safety');

insert into s2b1_ids (key, id)
select 'cross_org_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'other_programme_version'),
  (select id from s2b1_ids where key = 'other_category'),
  'Cross org unreadable suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'cross_org_suggestion')),
  'cross org suggestion submits'
);

-- Owner portfolio baseline
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner selects organisation for portfolio queries'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'visible_suggestion')
  ),
  'A ordinary visible suggestion is returned'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'cross_org_suggestion')
  ),
  'C cross-org suggestion is absent from portfolio'
);

select ok(
  (
    select item_row ->> 'active_reviewer_member_id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'unassigned_suggestion')
    limit 1
  ) is null,
  'D unassigned suggestion has null active reviewer fields for manager'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'unassigned'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'unassigned_suggestion')
  ),
  'D reviewer=unassigned includes claimable suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'reviewer selects organisation for mine filter'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'mine'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
  ),
  'E reviewer=mine includes active assignment to current membership'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'mine'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'unassigned_suggestion')
  ),
  'F reviewer=mine excludes unassigned suggestions'
);

-- Reassignment: only current active reviewer represented
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner selects organisation for reassignment'
);

insert into s2b1_ids (key, id)
select 'reassign_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Reassignment suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'reassign_suggestion')),
  'reassignment suggestion submits'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b1_ids where key = 'reassign_suggestion'),
    (select id from s2b1_ids where key = 'owner_membership')
  ) is not null,
  'owner initially assigned as reviewer'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b1_ids where key = 'reassign_suggestion'),
    (select id from s2b1_ids where key = 'reviewer_membership')
  ) is not null,
  'manager reassigns reviewer'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'reassign_suggestion')
  ),
  1,
  'H reassignment returns exactly one portfolio row'
);

select is(
  (
    select item_row ->> 'active_reviewer_member_id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'reassign_suggestion')
    limit 1
  ),
  (select id::text from s2b1_ids where key = 'reviewer_membership'),
  'H reassignment exposes only current active reviewer'
);

select ok(
  not exists (
    select 1
    from public.suggestion_review_assignments assignment_row
    where assignment_row.suggestion_id = (select id from s2b1_ids where key = 'reassign_suggestion')
      and assignment_row.status = 'active'
      and assignment_row.reviewer_membership_id = (select id from s2b1_ids where key = 'owner_membership')
  ),
  'G historical assignment is not active after reassignment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'reviewer selects organisation for metadata checks'
);

select is(
  (
    select item_row ->> 'active_reviewer_member_id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
    limit 1
  ),
  (select id::text from s2b1_ids where key = 'reviewer_membership'),
  'I active reviewer metadata exposes membership id'
);

select is(
  (
    select item_row ->> 'active_reviewer_display_name'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
    limit 1
  ),
  'S2b1 Reviewer',
  'I active reviewer metadata exposes safe display name'
);

select is(
  (
    select item_row ->> 'active_reviewer_assignment_kind'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
    limit 1
  ),
  'assigned',
  'I active reviewer metadata exposes assignment kind'
);

select ok(
  (
    select (item_row ->> 'is_active_reviewer')::boolean
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
    limit 1
  ),
  'assigned reviewer sees is_active_reviewer true'
);

-- Read-only user visibility boundary
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000003","email":"s2b1-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'reader selects organisation'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'visible_suggestion')
  ),
  'J read-only user can see readable suggestion'
);

select ok(
  (
    select item_row ->> 'active_reviewer_member_id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
    limit 1
  ) is null,
  'J read-only user cannot receive reviewer metadata'
);

select is(
  (
    select jsonb_array_length(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'unassigned'
      ) -> 'items'
    )
  ),
  0,
  'K read-only user cannot enumerate unassigned review state'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000005","email":"s2b1-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'outsider without grants selects organisation'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'visible_suggestion')
  ),
  'B unreadable suggestion is absent for outsider without read grants'
);

-- Temporary visibility for assigned reviewer before decision
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
  ),
  'L assigned reviewer retains portfolio read access'
);

-- End assignment visibility probe
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);

insert into s2b1_ids (key, id)
select 'visibility_suggestion', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'Ended assignment visibility suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'visibility_suggestion')),
  'visibility suggestion submits'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from s2b1_ids where key = 'visibility_suggestion'),
    (select id from s2b1_ids where key = 'reviewer_membership')
  ) is not null,
  'manager assigns reviewer for visibility probe'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  public.begin_suggestion_review((select id from s2b1_ids where key = 'visibility_suggestion')),
  'reviewer begins review for visibility probe'
);

select ok(
  public.approve_suggestion(
    (select id from s2b1_ids where key = 'visibility_suggestion'),
    'medium',
    'medium',
    'Approved and assignment ended',
    'Approved — thank you for the improvement idea.'
  ) is not null,
  'reviewer approves visibility suggestion'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'visibility_suggestion')
  ),
  'M ended assignment removes temporary reviewer read access'
);

-- Count accuracy and pagination
select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'mine'
  ) ->> 'total_count')::integer >= 2,
  'N reviewer=mine total_count reflects active assignments'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner selects organisation for unassigned count'
);

select ok(
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'unassigned'
  ) ->> 'total_count')::integer >= 1,
  'O reviewer=unassigned total_count reflects claimable queue'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000002","email":"s2b1-reviewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'reviewer selects organisation for pagination probe'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'assigned_suggestion')
  ),
  1,
  'P pagination does not duplicate assigned suggestion rows'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, 'parked', null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'parked_suggestion')
      and item_row ->> 'status' = 'parked'
  ),
  'Q status=parked filter works'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from s2b1_ids where key = 'organisation')),
  'owner selects organisation for search probes'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        '%', null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'title' = 'Literal percent % title'
  ),
  'R search literal percent works'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        '_', null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'title' = 'Literal underscore _ title'
  ),
  'S search literal underscore works'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        E'\\', null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'title' = E'Literal backslash \\ title'
  ),
  'T search literal backslash works'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null,
        null,
        (select id from s2b1_ids where key = 'programme_version'),
        (select id from s2b1_ids where key = 'category'),
        (select id from s2b1_ids where key = 'unit_root'),
        'newest',
        1,
        25,
        'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from s2b1_ids where key = 'visible_suggestion')
  ),
  'U programme/category/origin-unit filters retain behaviour'
);

select ok(
  (
    select item_row ->> 'id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'title_asc', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    limit 1
  ) is not null,
  'V title_asc sort returns deterministic first row'
);

-- Deterministic secondary ordering when primary sort values tie
insert into s2b1_ids (key, id)
select 'tie_newest_a', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'TIE-NEWEST-A',
  'Problem text',
  'Idea text',
  'Benefit text'
);

insert into s2b1_ids (key, id)
select 'tie_newest_b', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'TIE-NEWEST-B',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'tie_newest_a')),
  'tie-newest suggestion A submits'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'tie_newest_b')),
  'tie-newest suggestion B submits'
);

reset role;

update public.improvement_suggestions suggestion_row
set created_at = timestamptz '2020-06-01 12:00:00+00',
    updated_at = timestamptz '2020-06-01 12:00:00+00'
where suggestion_row.id in (
  (select id from s2b1_ids where key = 'tie_newest_a'),
  (select id from s2b1_ids where key = 'tie_newest_b')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select item_row ->> 'id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        'TIE-NEWEST', null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) with ordinality as ordered_items(item_row, item_order)
    where item_order = 1
  ),
  greatest(
    (select id from s2b1_ids where key = 'tie_newest_a'),
    (select id from s2b1_ids where key = 'tie_newest_b')
  )::text,
  'newest tie-break uses id DESC when created_at matches'
);

select is(
  (
    select item_row ->> 'id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        'TIE-NEWEST', null, null, null, null, 'updated', 1, 25, 'all'
      ) -> 'items'
    ) with ordinality as ordered_items(item_row, item_order)
    where item_order = 1
  ),
  greatest(
    (select id from s2b1_ids where key = 'tie_newest_a'),
    (select id from s2b1_ids where key = 'tie_newest_b')
  )::text,
  'updated tie-break uses id DESC when updated_at matches'
);

select is(
  (
    select item_row ->> 'id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        'TIE-NEWEST', null, null, null, null, 'oldest', 1, 25, 'all'
      ) -> 'items'
    ) with ordinality as ordered_items(item_row, item_order)
    where item_order = 1
  ),
  least(
    (select id from s2b1_ids where key = 'tie_newest_a'),
    (select id from s2b1_ids where key = 'tie_newest_b')
  )::text,
  'oldest tie-break uses id ASC when created_at matches'
);

insert into s2b1_ids (key, id)
select 'tie_title_a', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'TIE-TITLE-SHARED',
  'Problem text',
  'Idea text',
  'Benefit text'
);

insert into s2b1_ids (key, id)
select 'tie_title_b', public.create_suggestion_draft(
  (select id from s2b1_ids where key = 'programme_version'),
  (select id from s2b1_ids where key = 'category'),
  'TIE-TITLE-SHARED',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'tie_title_a')),
  'tie-title suggestion A submits'
);

select ok(
  public.submit_suggestion((select id from s2b1_ids where key = 'tie_title_b')),
  'tie-title suggestion B submits'
);

select is(
  (
    select item_row ->> 'id'
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        'TIE-TITLE-SHARED', null, null, null, null, 'title_asc', 1, 25, 'all'
      ) -> 'items'
    ) with ordinality as ordered_items(item_row, item_order)
    where item_order = 1
  ),
  least(
    (select id from s2b1_ids where key = 'tie_title_a'),
    (select id from s2b1_ids where key = 'tie_title_b')
  )::text,
  'title_asc tie-break uses id ASC when title matches'
);

insert into s2b1_ids (key, id)
select
  'tie_page_' || series_n::text,
  public.create_suggestion_draft(
    (select id from s2b1_ids where key = 'programme_version'),
    (select id from s2b1_ids where key = 'category'),
    'TIE-PAGE-' || lpad(series_n::text, 2, '0'),
    'Problem text',
    'Idea text',
    'Benefit text'
  )
from generate_series(1, 26) as series_n;

select ok(
  (
    select count(*)::integer
    from generate_series(1, 26) as series_n
    where public.submit_suggestion(
      (select id from s2b1_ids where key = 'tie_page_' || series_n::text)
    )
  ) = 26,
  'tie-page suggestions submit'
);

reset role;

update public.improvement_suggestions suggestion_row
set created_at = timestamptz '2020-07-01 12:00:00+00',
    updated_at = timestamptz '2020-07-01 12:00:00+00'
where suggestion_row.title like 'TIE-PAGE-%';

select set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d3100000-0000-0000-0000-000000000001","email":"s2b1-owner@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from (
      select item_row ->> 'id' as suggestion_id
      from jsonb_array_elements(
        public.get_suggestion_portfolio(
          'TIE-PAGE', null, null, null, null, 'newest', 1, 25, 'all'
        ) -> 'items'
      ) page_one(item_row)
      intersect
      select item_row ->> 'id' as suggestion_id
      from jsonb_array_elements(
        public.get_suggestion_portfolio(
          'TIE-PAGE', null, null, null, null, 'newest', 2, 25, 'all'
        ) -> 'items'
      ) page_two(item_row)
    ) overlap_ids
  ),
  0,
  'tied newest pagination has no duplicate rows across pages'
);

select is(
  (
    select count(distinct suggestion_id)::integer
    from (
      select item_row ->> 'id' as suggestion_id
      from jsonb_array_elements(
        public.get_suggestion_portfolio(
          'TIE-PAGE', null, null, null, null, 'newest', 1, 25, 'all'
        ) -> 'items'
      ) page_one(item_row)
      union all
      select item_row ->> 'id' as suggestion_id
      from jsonb_array_elements(
        public.get_suggestion_portfolio(
          'TIE-PAGE', null, null, null, null, 'newest', 2, 25, 'all'
        ) -> 'items'
      ) page_two(item_row)
    ) combined_pages
  ),
  26,
  'tied newest pagination returns all tied rows across pages'
);

select * from finish();
rollback;
