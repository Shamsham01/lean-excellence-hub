begin;

select plan(26);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '9a000000-0000-0000-0000-000000000001',
    'scope-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '9a000000-0000-0000-0000-000000000002',
    'scope-admin@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '9a000000-0000-0000-0000-000000000003',
    'scope-manager@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '9a000000-0000-0000-0000-000000000004',
    'scope-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table scope_policy_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on scope_policy_ids to authenticated;

insert into scope_policy_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '9a000000-0000-0000-0000-000000000001',
    'scope-policy-org',
    'Scope Policy Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('9b000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('9b000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('9b000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('9b000000-0000-0000-0000-000000000004', '9a000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  ((select id from scope_policy_ids where key = 'organisation'), '9a000000-0000-0000-0000-000000000002', 'active', statement_timestamp()),
  ((select id from scope_policy_ids where key = 'organisation'), '9a000000-0000-0000-0000-000000000003', 'active', statement_timestamp()),
  ((select id from scope_policy_ids where key = 'organisation'), '9a000000-0000-0000-0000-000000000004', 'active', statement_timestamp());

update private.identity_controls
set status = 'active', enrolment_status = 'complete', enrolment_completed_at = statement_timestamp()
where user_id in (
  '9a000000-0000-0000-0000-000000000002',
  '9a000000-0000-0000-0000-000000000003',
  '9a000000-0000-0000-0000-000000000004'
);

insert into scope_policy_ids (key, id)
select 'admin_membership', id from public.organisation_memberships
where organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and user_id = '9a000000-0000-0000-0000-000000000002';

insert into scope_policy_ids (key, id)
select 'manager_membership', id from public.organisation_memberships
where organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and user_id = '9a000000-0000-0000-0000-000000000003';

insert into scope_policy_ids (key, id)
select 'member_membership', id from public.organisation_memberships
where organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and user_id = '9a000000-0000-0000-0000-000000000004';

insert into scope_policy_ids (key, id)
select 'admin_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and role_row.canonical_name = 'organisation-administrator' and role_version.status = 'published';

insert into scope_policy_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and role_row.canonical_name = 'manager' and role_version.status = 'published';

insert into scope_policy_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member' and role_version.status = 'published';

insert into scope_policy_ids (key, id)
select 'finance_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from scope_policy_ids where key = 'organisation')
  and role_row.canonical_name = 'finance-validator' and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"9a000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"9b000000-0000-0000-0000-000000000001","email":"scope-owner@example.test"}',
  true
);
set local role authenticated;

select ok(public.switch_organisation((select id from scope_policy_ids where key = 'organisation')), 'owner selects organisation before unit setup');

insert into scope_policy_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from scope_policy_ids where key = 'organisation'),
  null,
  'scope-root',
  'Scope Root',
  'site'
);

insert into scope_policy_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from scope_policy_ids where key = 'organisation'),
  (select id from scope_policy_ids where key = 'root_unit'),
  'scope-child',
  'Scope Child',
  'department'
);

insert into scope_policy_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from scope_policy_ids where key = 'organisation'),
  (select id from scope_policy_ids where key = 'root_unit'),
  'scope-sibling',
  'Scope Sibling',
  'department'
);

select ok(
  public.grant_role_version(
    (select id from scope_policy_ids where key = 'organisation'),
    (select id from scope_policy_ids where key = 'admin_membership'),
    (select id from scope_policy_ids where key = 'admin_role_version'),
    'organisation',
    null
  ) is not null,
  'owner grants organisation administrator role'
);

select ok(
  public.grant_role_version(
    (select id from scope_policy_ids where key = 'organisation'),
    (select id from scope_policy_ids where key = 'manager_membership'),
    (select id from scope_policy_ids where key = 'manager_role_version'),
    'unit_subtree',
    (select id from scope_policy_ids where key = 'child_unit')
  ) is not null,
  'owner grants manager role at unit subtree'
);

select ok(
  public.grant_role_version(
    (select id from scope_policy_ids where key = 'organisation'),
    (select id from scope_policy_ids where key = 'member_membership'),
    (select id from scope_policy_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from scope_policy_ids where key = 'child_unit')
  ) is not null,
  'owner grants team member role at unit subtree'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'organisation-owner'
      and scope_option ->> 'scope_type' <> 'organisation'
  ),
  'owner role offers organisation scope only'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'manager'
      and scope_option ->> 'scope_type' = 'organisation'
  ),
  'manager role does not offer organisation scope'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'team-member'
      and scope_option ->> 'scope_type' = 'organisation'
  ),
  'team member role does not offer organisation scope'
);

select throws_ok(
  format(
    'select public.grant_role_version(%L::uuid, %L::uuid, %L::uuid, %L, null)',
    (select id from scope_policy_ids where key = 'organisation'),
    (select id from scope_policy_ids where key = 'member_membership'),
    (select id from scope_policy_ids where key = 'team_member_role_version'),
    'organisation'
  ),
  '42501',
  'role scope is not permitted for this role',
  'direct grant_role_version bypass with invalid team member organisation scope fails'
);

select throws_ok(
  format(
    'select public.issue_organisation_invitation(%L::uuid, %L, %L, %L::bytea, %L::timestamptz, %L::uuid, %L, null)',
    (select id from scope_policy_ids where key = 'organisation'),
    'email',
    'invalid-scope-invite@example.test',
    decode(repeat('ab', 32), 'hex'),
    statement_timestamp() + interval '1 day',
    (select id from scope_policy_ids where key = 'manager_role_version'),
    'organisation'
  ),
  '42501',
  'role scope is not permitted for this role',
  'direct invitation issue with invalid manager organisation scope fails'
);

select ok(
  private.role_grant_scope_allowed(
    (select id from scope_policy_ids where key = 'organisation'),
    (
      select role_row.id
      from public.roles role_row
      where role_row.organisation_id = (select id from scope_policy_ids where key = 'organisation')
        and role_row.canonical_name = 'manager'
    ),
    'unit_subtree'
  )
  and not private.role_grant_scope_allowed(
    (select id from scope_policy_ids where key = 'organisation'),
    (
      select role_row.id
      from public.roles role_row
      where role_row.organisation_id = (select id from scope_policy_ids where key = 'organisation')
        and role_row.canonical_name = 'manager'
    ),
    'organisation'
  ),
  'baseline manager scope policy allows unit subtree only'
);

select lives_ok(
  $$
    select private.ensure_baseline_role_grant_scope_policies(
      (select id from scope_policy_ids where key = 'organisation')
    )
  $$,
  're-running scope policy ensure is idempotent'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9a000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"9b000000-0000-0000-0000-000000000002","email":"scope-admin@example.test"}',
  true
);

select ok(public.switch_organisation((select id from scope_policy_ids where key = 'organisation')), 'admin selects organisation');

select ok(
  exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'manager'
  ),
  'organisation administrator can delegate manager'
);

select ok(
  exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'team-member'
  ),
  'organisation administrator can delegate team member'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'finance-validator'
  ),
  'organisation administrator cannot delegate finance validator'
);

select ok(
  exists (
    select 1 from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'organisation-administrator'
  ),
  'organisation administrator can delegate another organisation administrator'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9a000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"9b000000-0000-0000-0000-000000000003","email":"scope-manager@example.test"}',
  true
);

select ok(public.switch_organisation((select id from scope_policy_ids where key = 'organisation')), 'manager selects organisation');

select ok(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers') = 0,
  'manager cannot delegate roles'
);

select ok(
  private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'manager_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'actions.read',
    null,
    (select id from scope_policy_ids where key = 'child_unit')
  ),
  'manager can read actions within delegated subtree'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'manager_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'actions.read',
    null,
    (select id from scope_policy_ids where key = 'sibling_unit')
  ),
  'manager cannot read actions outside delegated subtree'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'manager_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'memberships.manage',
    null,
    null
  ),
  'manager cannot manage memberships'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9a000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"9b000000-0000-0000-0000-000000000004","email":"scope-member@example.test"}',
  true
);

select ok(public.switch_organisation((select id from scope_policy_ids where key = 'organisation')), 'team member selects organisation');

select ok(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers') = 0,
  'team member cannot delegate roles'
);

select ok(
  private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'member_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'training.read',
    null,
    (select id from scope_policy_ids where key = 'child_unit')
  ),
  'team member can read training within unit subtree'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'member_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'job_functions.manage',
    null,
    (select id from scope_policy_ids where key = 'child_unit')
  ),
  'team member cannot manage job functions'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from scope_policy_ids where key = 'member_membership'),
    (select id from scope_policy_ids where key = 'organisation'),
    'roles.delegate',
    null,
    (select id from scope_policy_ids where key = 'child_unit')
  ),
  'team member cannot delegate roles'
);

select * from finish();
rollback;
