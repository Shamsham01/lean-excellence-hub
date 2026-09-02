begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b1000000-0000-0000-0000-000000000001',
  'review-atomic-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table review_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on review_ids to authenticated;

insert into review_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000001',
    'review-atomic-org',
    'Review Atomic Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000001","email":"review-atomic-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into review_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from review_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into review_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into review_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from review_ids where key = 'organisation')
  and membership_row.user_id = 'b1000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from review_ids where key = 'owner_membership'),
    (select id from review_ids where key = 'job_function'),
    true,
    (select id from review_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into review_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into review_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from review_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from review_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into review_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into review_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from review_ids where key = 'programme_version'),
  (select id from review_ids where key = 'category'),
  'Atomic review suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(public.submit_suggestion((select id from review_ids where key = 'suggestion')), 'suggestion submits');
select ok(
  public.claim_suggestion_for_review((select id from review_ids where key = 'suggestion')) is not null,
  'reviewer claim succeeds'
);
select ok(
  public.begin_suggestion_review((select id from review_ids where key = 'suggestion')),
  'review begins'
);

insert into review_ids (key, id)
select 'review_id', public.record_suggestion_review(
  (select id from review_ids where key = 'suggestion'),
  'accept',
  'medium',
  'low',
  'Accepted in atomic transaction'
);

select is(
  (select status from public.improvement_suggestions
   where id = (select id from review_ids where key = 'suggestion')),
  'accepted',
  'accept decision transitions suggestion status'
);

select is(
  (select count(*)::integer
   from public.suggestion_review_assignments assignment_row
   where assignment_row.suggestion_id = (select id from review_ids where key = 'suggestion')
     and assignment_row.status = 'completed'),
  1,
  'active reviewer assignment completes on accept'
);

select is(
  (select count(*)::integer from public.suggestion_reviews review_row
   where review_row.suggestion_id = (select id from review_ids where key = 'suggestion')),
  1,
  'immutable review row is recorded'
);

select * from finish();
rollback;
