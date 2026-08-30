begin;

select plan(12);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'profile-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'profile-member-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'profile-member-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'profile-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table profile_self_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on profile_self_ids to authenticated;

insert into profile_self_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1000000-0000-0000-0000-000000000001',
    'profile-self-org',
    'Profile Self Org'
  )
);

insert into profile_self_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'a1000000-0000-0000-0000-000000000004',
    'profile-other-org',
    'Profile Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  ((select id from profile_self_ids where key = 'organisation'), 'a1000000-0000-0000-0000-000000000002', 'active', statement_timestamp()),
  ((select id from profile_self_ids where key = 'organisation'), 'a1000000-0000-0000-0000-000000000003', 'active', statement_timestamp());

update private.identity_controls
set status = 'active', enrolment_status = 'complete', enrolment_completed_at = statement_timestamp()
where user_id in (
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);

insert into profile_self_ids (key, id)
select 'member_a_membership', id from public.organisation_memberships
where organisation_id = (select id from profile_self_ids where key = 'organisation')
  and user_id = 'a1000000-0000-0000-0000-000000000002';

insert into profile_self_ids (key, id)
select 'member_b_membership', id from public.organisation_memberships
where organisation_id = (select id from profile_self_ids where key = 'organisation')
  and user_id = 'a1000000-0000-0000-0000-000000000003';

insert into profile_self_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from profile_self_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a2000000-0000-0000-0000-000000000001","email":"profile-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from profile_self_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into profile_self_ids (key, id)
select 'production_unit', public.create_organisation_unit(
  (select id from profile_self_ids where key = 'organisation'),
  null,
  'production',
  'Production',
  'site'
);

insert into profile_self_ids (key, id)
select 'line_3_unit', public.create_organisation_unit(
  (select id from profile_self_ids where key = 'organisation'),
  (select id from profile_self_ids where key = 'production_unit'),
  'line-3',
  'Line 3',
  'line'
);

insert into profile_self_ids (key, id)
select 'operator_job_function', public.create_job_function(
  'Production Operator',
  'production-operator'
);

select ok(
  public.assign_membership_job_function(
    (select id from profile_self_ids where key = 'member_a_membership'),
    (select id from profile_self_ids where key = 'operator_job_function'),
    true,
    (select id from profile_self_ids where key = 'line_3_unit')
  ) is not null,
  'owner assigns member primary job function and work area'
);

select ok(
  public.grant_role_version(
    (select id from profile_self_ids where key = 'organisation'),
    (select id from profile_self_ids where key = 'member_a_membership'),
    (select id from profile_self_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from profile_self_ids where key = 'production_unit')
  ) is not null,
  'owner grants team member role at production subtree'
);

select ok(
  public.grant_role_version(
    (select id from profile_self_ids where key = 'organisation'),
    (select id from profile_self_ids where key = 'member_b_membership'),
    (select id from profile_self_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from profile_self_ids where key = 'production_unit')
  ) is not null,
  'owner grants second team member role at production subtree'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a2000000-0000-0000-0000-000000000002","email":"profile-member-a@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from profile_self_ids where key = 'organisation')),
  'team member selects organisation'
);

select ok(
  jsonb_array_length(
    public.get_membership_administration_profile(
      (select id from profile_self_ids where key = 'member_a_membership')
    ) -> 'access_grants'
  ) = 1,
  'team member can read own active access grants'
);

select ok(
  (
    public.get_membership_administration_profile(
      (select id from profile_self_ids where key = 'member_a_membership')
    ) -> 'access_grants' -> 0 ->> 'role_display_name'
  ) = 'Team Member',
  'team member self profile returns Team Member role display name'
);

select ok(
  (
    public.get_membership_administration_profile(
      (select id from profile_self_ids where key = 'member_a_membership')
    ) -> 'access_grants' -> 0 ->> 'scope_type'
  ) = 'unit_subtree',
  'team member self profile returns scope type'
);

select ok(
  (
    public.get_membership_administration_profile(
      (select id from profile_self_ids where key = 'member_a_membership')
    ) -> 'access_grants' -> 0 ->> 'scope_unit_name'
  ) = 'Production',
  'team member self profile returns scope unit display name'
);

select throws_ok(
  format(
    'select public.get_membership_administration_profile(%L::uuid)',
    (select id from profile_self_ids where key = 'member_b_membership')
  ),
  '42501',
  'membership administration profile is not authorised',
  'team member cannot read another member administration profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"a2000000-0000-0000-0000-000000000004","email":"profile-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from profile_self_ids where key = 'other_organisation')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.get_membership_administration_profile(%L::uuid)',
    (select id from profile_self_ids where key = 'member_a_membership')
  ),
  'P0002',
  'membership not found',
  'cross-organisation membership profile read is denied'
);

select * from finish();
rollback;
