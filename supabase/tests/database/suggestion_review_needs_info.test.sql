begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b1100000-0000-0000-0000-000000000001',
  'needs-info-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table needs_info_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on needs_info_ids to authenticated;

insert into needs_info_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1100000-0000-0000-0000-000000000001',
    'needs-info-org',
    'Needs Info Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2100000-0000-0000-0000-000000000001',
  'b1100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2100000-0000-0000-0000-000000000001","email":"needs-info-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from needs_info_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into needs_info_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from needs_info_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into needs_info_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into needs_info_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from needs_info_ids where key = 'organisation')
  and membership_row.user_id = 'b1100000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from needs_info_ids where key = 'owner_membership'),
    (select id from needs_info_ids where key = 'job_function'),
    true,
    (select id from needs_info_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into needs_info_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into needs_info_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from needs_info_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from needs_info_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into needs_info_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into needs_info_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from needs_info_ids where key = 'programme_version'),
  (select id from needs_info_ids where key = 'category'),
  'Needs info suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(public.submit_suggestion((select id from needs_info_ids where key = 'suggestion')), 'suggestion submits');
select ok(
  public.claim_suggestion_for_review((select id from needs_info_ids where key = 'suggestion')) is not null,
  'reviewer claim succeeds'
);
select ok(
  public.begin_suggestion_review((select id from needs_info_ids where key = 'suggestion')),
  'review begins'
);

select ok(
  public.record_suggestion_review(
    (select id from needs_info_ids where key = 'suggestion'),
    'needs_more_information',
    'low',
    'low',
    'Internal: need clarification on scope',
    null,
    'Need clarification on scope'
  ) is not null,
  'needs_more_information review is recorded'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from needs_info_ids where key = 'suggestion')),
  'under_review',
  'suggestion stays under_review after needs_more_information'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from needs_info_ids where key = 'suggestion')
     and assignment_row.status = 'active'
     and assignment_row.completed_at is null),
  1,
  'active reviewer assignment remains active'
);

select * from finish();
rollback;
