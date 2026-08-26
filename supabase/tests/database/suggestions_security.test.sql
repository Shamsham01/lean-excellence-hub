begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1000000-0000-0000-0000-000000000001',
  'suggestions-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table suggestion_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on suggestion_ids to authenticated;

insert into suggestion_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1000000-0000-0000-0000-000000000001',
    'suggestions-org',
    'Suggestions Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a2000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a2000000-0000-0000-0000-000000000001","email":"suggestions-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from suggestion_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into suggestion_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from suggestion_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into suggestion_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select membership_table.id
     from public.organisation_memberships membership_table
     where membership_table.organisation_id = (select id from suggestion_ids where key = 'organisation')
       and membership_table.user_id = 'a1000000-0000-0000-0000-000000000001'),
    (select id from suggestion_ids where key = 'job_function'),
    true,
    (select id from suggestion_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment for submit scope'
);

insert into suggestion_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Everyday Ideas', 'everyday-ideas', 'demo programme'
);

insert into suggestion_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from suggestion_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from suggestion_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into suggestion_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into suggestion_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from suggestion_ids where key = 'programme_version'),
  (select id from suggestion_ids where key = 'category'),
  'Test suggestion',
  'Problem observed on the line',
  'Proposed improvement idea',
  'Expected benefit'
);

select ok(
  public.submit_suggestion((select id from suggestion_ids where key = 'suggestion')),
  'suggestion submits'
);

select ok(
  (select suggestion_number from public.improvement_suggestions
   where id = (select id from suggestion_ids where key = 'suggestion')) like 'IDEA-%',
  'submitted suggestion has display number'
);

select throws_ok(
  $$ update public.improvement_suggestions
     set title = 'Changed'
     where id = (select id from suggestion_ids where key = 'suggestion') $$,
  'submitted suggestion content is immutable',
  '55000'
);

select * from finish();
rollback;
