begin;

select plan(23);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '98000000-0000-0000-0000-000000000001',
    'baseline-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    'baseline-admin@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '98000000-0000-0000-0000-000000000003',
    'baseline-other-org@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table baseline_ids (
  key text primary key,
  id uuid,
  int_value bigint default null
) on commit drop;

grant select, insert, update on baseline_ids to authenticated;

insert into baseline_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '98000000-0000-0000-0000-000000000001',
    'baseline-org',
    'Baseline Org'
  )
);

insert into baseline_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    '98000000-0000-0000-0000-000000000003',
    'baseline-other-org',
    'Baseline Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '99000000-0000-0000-0000-000000000001',
  '98000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select is(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.status = 'active'
      and role_row.is_owner_role
  ),
  1::bigint,
  'exactly one Organisation Owner role exists'
);

select is(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.status = 'active'
      and role_row.canonical_name = any (
        array[
          'organisation-owner',
          'organisation-administrator',
          'manager',
          'team-member',
          'finance-validator'
        ]
      )
  ),
  5::bigint,
  'baseline catalogue contains owner plus four default application roles'
);

select is(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.status = 'active'
      and role_row.canonical_name in (
        'organisation-administrator',
        'manager',
        'team-member',
        'finance-validator'
      )
  ),
  4::bigint,
  'each baseline canonical role exists exactly once'
);

select ok(
  not exists (
    select role_row.canonical_name
    from public.roles role_row
    join public.role_versions role_version
      on role_version.organisation_id = role_row.organisation_id
     and role_version.role_id = role_row.id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.status = 'active'
      and role_row.canonical_name in (
        'organisation-administrator',
        'manager',
        'team-member',
        'finance-validator'
      )
    group by role_row.canonical_name
    having count(*) filter (where role_version.status = 'published') <> 1
  ),
  'each baseline role has one current published version'
);

select ok(
  (
    select count(*) = 1
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'organisation-administrator'
  )
  and (
    select count(*) > 0
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'organisation-administrator'
      and role_permission.permission_key in ('roles.delegate', 'actions.read', 'suggestions.submit')
  )
  and (
    select count(*) = 50
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'manager'
  )
  and (
    select count(*) = 21
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'team-member'
  )
  and (
    select count(*) = 5
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'finance-validator'
  ),
  'baseline role permission counts match the least-privilege catalogue'
);

select ok(
  not exists (
    select 1
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'organisation-administrator'
      and role_permission.permission_key in ('roles.manage', 'security_audit.read')
  ),
  'organisation administrator does not receive owner-only protected permissions'
);

select ok(
  not exists (
    select 1
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'manager'
      and role_permission.permission_key in (
        'roles.manage',
        'roles.delegate',
        'invitations.manage',
        'memberships.manage',
        'organisation.update',
        'security_audit.read'
      )
  ),
  'manager does not receive owner or protected administration permissions'
);

select ok(
  not exists (
    select 1
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'team-member'
      and role_permission.permission_key in (
        'memberships.manage',
        'roles.manage',
        'roles.delegate',
        'job_functions.manage',
        'invitations.manage',
        'hierarchy.manage',
        'organisation.update'
      )
  ),
  'team member cannot manage memberships or roles'
);

select ok(
  not exists (
    select 1
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'finance-validator'
      and role_permission.permission_key not in (
        'hierarchy.read',
        'memberships.read',
        'benefits.read',
        'benefits.validate.finance',
        'benefits.realisation.validate'
      )
  ),
  'finance validator remains limited to finance validation and required reads'
);

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from baseline_ids where key = 'organisation'),
  '98000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

insert into baseline_ids (key, id)
select 'admin_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from baseline_ids where key = 'organisation')
  and membership.user_id = '98000000-0000-0000-0000-000000000002';

insert into baseline_ids (key, id)
select 'admin_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from baseline_ids where key = 'organisation')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

insert into public.access_grants (
  organisation_id,
  grantee_membership_id,
  role_version_id,
  scope_type,
  grantor_membership_id
)
select
  (select id from baseline_ids where key = 'organisation'),
  (select id from baseline_ids where key = 'admin_membership'),
  (select id from baseline_ids where key = 'admin_role_version'),
  'organisation',
  (
    select id
    from public.organisation_memberships
    where organisation_id = (select id from baseline_ids where key = 'organisation')
      and user_id = '98000000-0000-0000-0000-000000000001'
  );

select ok(
  not private.membership_is_effective_owner(
    (select id from baseline_ids where key = 'admin_membership'),
    (select id from baseline_ids where key = 'organisation')
  ),
  'organisation administrator grant is not an effective owner'
);

insert into baseline_ids (key, id, int_value)
select
  'grant_count_before',
  (select id from baseline_ids where key = 'organisation'),
  (
    select count(*)
    from public.access_grants
    where organisation_id = (select id from baseline_ids where key = 'organisation')
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"98000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"99000000-0000-0000-0000-000000000001","email":"baseline-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from baseline_ids where key = 'organisation')),
  'owner selects organisation for custom role and backfill rerun'
);

insert into baseline_ids (key, id)
select 'custom_role_draft', public.create_role_draft(
  (select id from baseline_ids where key = 'organisation'),
  'custom-quality-lead',
  'Custom Quality Lead',
  'Customer-created role preserved by backfill'
);

select ok(
  public.add_role_permission(
    (select id from baseline_ids where key = 'organisation'),
    (select id from baseline_ids where key = 'custom_role_draft'),
    'actions.read'
  ),
  'custom role receives a permission'
);

select ok(
  public.publish_role_version(
    (select id from baseline_ids where key = 'organisation'),
    (select id from baseline_ids where key = 'custom_role_draft')
  ),
  'custom role publishes'
);

select ok(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name = 'custom-quality-lead'
  ) = 1,
  'existing custom role is preserved'
);

select lives_ok(
  $$
    select private.ensure_organisation_baseline_application_roles(
      (select id from baseline_ids where key = 'organisation'),
      (
        select id
        from public.organisation_memberships
        where organisation_id = (select id from baseline_ids where key = 'organisation')
          and user_id = '98000000-0000-0000-0000-000000000001'
      )
    )
  $$,
  'baseline ensure routine is idempotent'
);

select is(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from baseline_ids where key = 'organisation')
      and role_row.canonical_name in (
        'organisation-administrator',
        'manager',
        'team-member',
        'finance-validator'
      )
  ),
  4::bigint,
  'rerunning baseline ensure does not create duplicate canonical roles'
);

select is(
  (
    select count(*)
    from public.access_grants
    where organisation_id = (select id from baseline_ids where key = 'organisation')
  ),
  (select int_value from baseline_ids where key = 'grant_count_before'),
  'existing access grants remain untouched by baseline ensure rerun'
);

insert into baseline_ids (key, id)
select 'offer_root_unit', public.create_organisation_unit(
  (select id from baseline_ids where key = 'organisation'),
  null,
  'catalogue-root',
  'Catalogue Root',
  'site'
);

select ok(
  (
    select count(*) = 5
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    where offer ->> 'role_display_name' in (
      'Organisation Owner',
      'Organisation Administrator',
      'Manager',
      'Team Member',
      'Finance Validator'
    )
  ),
  'owner receives delegatable offers for the full baseline catalogue'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    join public.role_versions role_version
      on role_version.id = (offer ->> 'role_version_id')::uuid
    where role_version.organisation_id = (
      select id from baseline_ids where key = 'other_organisation'
    )
  ),
  'cross-tenant roles never appear in delegation offers'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'manager'
      and scope_option ->> 'scope_type' = 'unit_subtree'
  ),
  'manager role can be offered at unit subtree scope by owner delegator'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'team-member'
      and scope_option ->> 'scope_type' = 'unit_subtree'
  ),
  'team member role can be offered at unit subtree scope by owner delegator'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' in ('manager', 'team-member')
      and scope_option ->> 'scope_type' = 'organisation'
  ),
  'manager and team member are not offered at organisation scope'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where offer ->> 'role_canonical_name' = 'finance-validator'
      and scope_option ->> 'scope_type' = 'organisation'
  ),
  'finance validator role can be offered at organisation scope by owner delegator'
);

select * from finish();
rollback;
