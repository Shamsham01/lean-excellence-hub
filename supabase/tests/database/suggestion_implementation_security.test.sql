begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c1400000-0000-0000-0000-000000000001',
  'implementation-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table implementation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on implementation_ids to authenticated;

insert into implementation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1400000-0000-0000-0000-000000000001',
    'implementation-org',
    'Implementation Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c1500000-0000-0000-0000-000000000001',
  'c1400000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1400000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1500000-0000-0000-0000-000000000001","email":"implementation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from implementation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into implementation_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from implementation_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into implementation_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select membership_table.id
     from public.organisation_memberships membership_table
     where membership_table.organisation_id = (select id from implementation_ids where key = 'organisation')
       and membership_table.user_id = 'c1400000-0000-0000-0000-000000000001'),
    (select id from implementation_ids where key = 'job_function'),
    true,
    (select id from implementation_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment for submit scope'
);

insert into implementation_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into implementation_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from implementation_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from implementation_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into implementation_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into implementation_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from implementation_ids where key = 'programme_version'),
  (select id from implementation_ids where key = 'category'),
  'Implementation suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select throws_ok(
  format(
    'select public.create_suggestion_action(%L::uuid, %L)',
    (select id from implementation_ids where key = 'suggestion'),
    'Draft action'
  ),
  'suggestion is not eligible for action creation',
  '55000'
);

select ok(
  public.submit_suggestion((select id from implementation_ids where key = 'suggestion')),
  'suggestion submits'
);

select ok(
  public.begin_suggestion_review((select id from implementation_ids where key = 'suggestion')),
  'review begins'
);

select ok(
  public.record_suggestion_review(
    (select id from implementation_ids where key = 'suggestion'),
    'accept',
    'medium',
    'low',
    'Accepted for implementation'
  ) is not null,
  'accepted review decision recorded'
);

select ok(
  public.begin_suggestion_implementation((select id from implementation_ids where key = 'suggestion')),
  'implementation phase begins'
);

select ok(
  public.create_suggestion_action(
    (select id from implementation_ids where key = 'suggestion'),
    'Install label holders',
    'Deploy holders on Line 2',
    'normal',
    null,
    'implementation'
  ) is not null,
  'accepted suggestion links created action safely'
);

select ok(
  public.create_improvement_project_from_suggestion(
    (select id from implementation_ids where key = 'suggestion')
  ) is not null,
  'accepted suggestion links CI project safely'
);

select * from finish();
rollback;
