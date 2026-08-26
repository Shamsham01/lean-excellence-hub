begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b1300000-0000-0000-0000-000000000001',
  'profile-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table profile_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on profile_ids to authenticated;

insert into profile_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1300000-0000-0000-0000-000000000001',
    'profile-org',
    'Profile Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2300000-0000-0000-0000-000000000001',
  'b1300000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1300000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2300000-0000-0000-0000-000000000001","email":"profile-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from profile_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into profile_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from profile_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into profile_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into profile_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from profile_ids where key = 'organisation')
  and membership_row.user_id = 'b1300000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from profile_ids where key = 'owner_membership'),
    (select id from profile_ids where key = 'job_function'),
    true,
    (select id from profile_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into profile_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into profile_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from profile_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from profile_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into profile_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into profile_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from profile_ids where key = 'programme_version'),
  (select id from profile_ids where key = 'category'),
  'Profile suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

select ok(public.submit_suggestion((select id from profile_ids where key = 'suggestion')), 'suggestion submits');

select is(
  (public.get_membership_improvement_contribution(
    (select id from profile_ids where key = 'owner_membership')
  ) ->> 'suggestions_authored')::integer,
  1,
  'profile contribution counts caller-visible authored suggestions'
);

select is(
  (public.get_membership_improvement_contribution(
    (select id from profile_ids where key = 'owner_membership')
  ) ->> 'suggestions_authored')::integer,
  (
    select count(*)::integer
    from public.improvement_suggestions suggestion_row
    where suggestion_row.author_membership_id = (select id from profile_ids where key = 'owner_membership')
      and private.can_read_improvement_suggestion(
        (select id from profile_ids where key = 'organisation'),
        suggestion_row.id
      )
  ),
  'profile contribution matches filtered suggestion count'
);

select * from finish();
rollback;
