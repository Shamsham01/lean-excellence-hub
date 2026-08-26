begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c1300000-0000-0000-0000-000000000001',
  'contributor-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1300000-0000-0000-0000-000000000003',
  'contributor-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table contributor_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on contributor_ids to authenticated;

insert into contributor_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1300000-0000-0000-0000-000000000001',
    'contributor-org',
    'Contributor Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c1400000-0000-0000-0000-000000000001',
  'c1300000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c1400000-0000-0000-0000-000000000003',
  'c1300000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1300000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1400000-0000-0000-0000-000000000001","email":"contributor-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from contributor_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into contributor_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from contributor_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into contributor_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into contributor_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from contributor_ids where key = 'organisation')
  and membership_row.user_id = 'c1300000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from contributor_ids where key = 'owner_membership'),
    (select id from contributor_ids where key = 'job_function'),
    true,
    (select id from contributor_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment for submit scope'
);

insert into contributor_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into contributor_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from contributor_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from contributor_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into contributor_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into contributor_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from contributor_ids where key = 'programme_version'),
  (select id from contributor_ids where key = 'category'),
  'Contributor access suggestion',
  'Problem observed on the line',
  'Proposed improvement idea',
  'Expected benefit'
);

select ok(
  public.submit_suggestion((select id from contributor_ids where key = 'suggestion')),
  'owner submits suggestion'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from contributor_ids where key = 'organisation'),
    'c1300000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into contributor_ids (key, id)
select 'outsider_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c1300000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"c1300000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1400000-0000-0000-0000-000000000001","email":"contributor-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_suggestion_contributor(
    (select id from contributor_ids where key = 'suggestion'),
    (select id from contributor_ids where key = 'outsider_membership'),
    'co_contributor'
  ) is not null,
  'contributor assignment is created'
);

select ok(
  public.assign_suggestion_reviewer(
    (select id from contributor_ids where key = 'suggestion'),
    (select id from contributor_ids where key = 'owner_membership')
  ) is not null,
  'reviewer assignment is created'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1300000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c1400000-0000-0000-0000-000000000003","email":"contributor-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from contributor_ids where key = 'organisation')),
  'outsider selects organisation'
);

select ok(
  not exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from contributor_ids where key = 'suggestion')
  ),
  'contributor assignment alone does not grant suggestion read without RBAC'
);

select throws_ok(
  format(
    'select public.assign_suggestion_reviewer(%L::uuid, %L::uuid)',
    (select id from contributor_ids where key = 'suggestion'),
    (select id from contributor_ids where key = 'outsider_membership')
  ),
  'reviewer assignment is not authorised',
  '42501'
);

select * from finish();
rollback;
