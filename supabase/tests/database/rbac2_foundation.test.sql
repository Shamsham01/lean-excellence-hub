begin;

select plan(30);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '9c000000-0000-0000-0000-000000000001',
    'rbac2-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '9c000000-0000-0000-0000-000000000002',
    'rbac2-subject@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '9c000000-0000-0000-0000-000000000003',
    'rbac2-inactive@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table rbac2_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on rbac2_ids to authenticated;

insert into rbac2_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '9c000000-0000-0000-0000-000000000001',
    'rbac2-org',
    'RBAC2 Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('9d000000-0000-0000-0000-000000000001', '9c000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('9d000000-0000-0000-0000-000000000002', '9c000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('9d000000-0000-0000-0000-000000000003', '9c000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  ((select id from rbac2_ids where key = 'organisation'), '9c000000-0000-0000-0000-000000000002', 'active', statement_timestamp()),
  ((select id from rbac2_ids where key = 'organisation'), '9c000000-0000-0000-0000-000000000003', 'inactive', statement_timestamp());

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '9c000000-0000-0000-0000-000000000002',
  '9c000000-0000-0000-0000-000000000003'
);

insert into rbac2_ids (key, id)
select 'subject_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and membership.user_id = '9c000000-0000-0000-0000-000000000002';

insert into rbac2_ids (key, id)
select 'inactive_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and membership.user_id = '9c000000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000001","email":"rbac2-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into rbac2_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from rbac2_ids where key = 'organisation'),
  null,
  'rbac2-root',
  'Production',
  'site'
);

insert into rbac2_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from rbac2_ids where key = 'organisation'),
  (select id from rbac2_ids where key = 'root_unit'),
  'rbac2-child',
  'Line 1',
  'line'
);

insert into rbac2_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from rbac2_ids where key = 'organisation'),
  (select id from rbac2_ids where key = 'root_unit'),
  'rbac2-sibling',
  'Packing',
  'department'
);

insert into rbac2_ids (key, id)
select 'suggestions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'suggestions'
  and role_version.status = 'published';

insert into rbac2_ids (key, id)
select 'five_s_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'five_s'
  and role_version.status = 'published';

insert into rbac2_ids (key, id)
select 'projects_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'projects'
  and role_version.status = 'published';

select is(
  (
    select count(*)
    from public.roles role_row
    where role_row.organisation_id = (select id from rbac2_ids where key = 'organisation')
      and role_row.status = 'active'
      and role_row.module_responsibility_key is not null
  ),
  13::bigint,
  'module responsibility catalogue provisioned (12 modules + admin tag)'
);

select ok(
  public.grant_role_version(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'suggestions_role_version'),
    'unit_subtree',
    (select id from rbac2_ids where key = 'root_unit')
  ) is not null,
  'grant Suggestions responsibility at Production subtree'
);

select ok(
  public.grant_role_version(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'five_s_role_version'),
    'unit_subtree',
    (select id from rbac2_ids where key = 'root_unit')
  ) is not null,
  'grant 5S responsibility at Production subtree'
);

select ok(
  public.grant_role_version(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'projects_role_version'),
    'organisation',
    null
  ) is not null,
  'grant Projects responsibility at organisation scope'
);

select is(
  (
    select count(*)
    from public.access_grants grant_row
    where grant_row.organisation_id = (select id from rbac2_ids where key = 'organisation')
      and grant_row.grantee_membership_id = (select id from rbac2_ids where key = 'subject_membership')
      and grant_row.status = 'active'
  ),
  3::bigint,
  'subject membership holds three simultaneous active grants'
);

select ok(
  private.membership_has_scoped_permission(
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'suggestions.review',
    null,
    (select id from rbac2_ids where key = 'child_unit')
  ),
  'Suggestions review allowed within Production subtree'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'suggestions.review',
    null,
    (select id from rbac2_ids where key = 'sibling_unit')
  ),
  'Suggestions review denied outside Production subtree'
);

select ok(
  private.membership_has_scoped_permission(
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from rbac2_ids where key = 'sibling_unit')
  ),
  'Projects organisation grant applies across units'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'suggestions.manage',
    null,
    (select id from rbac2_ids where key = 'sibling_unit')
  ),
  'Projects organisation grant does not widen Suggestions management'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000002","email":"rbac2-subject@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'subject selects organisation'
);

select ok(
  public.member_has_permission('suggestions.submit'),
  'baseline: active member can submit suggestions without management grant'
);

select ok(
  public.member_has_permission('suggestions.read'),
  'baseline: active member can read suggestions register'
);

select ok(
  not public.member_has_permission('suggestions.review'),
  'baseline: active member cannot review suggestions without responsibility'
);

select ok(
  not public.member_has_permission('suggestions.manage'),
  'baseline: active member cannot manage suggestions without responsibility'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000001","email":"rbac2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'owner re-selects organisation for revocation'
);

select ok(
  public.revoke_access_grant(
    (select id from rbac2_ids where key = 'organisation'),
    (
      select grant_row.id
      from public.access_grants grant_row
      join public.role_versions role_version on role_version.id = grant_row.role_version_id
      join public.roles role_row on role_row.id = role_version.role_id
      where grant_row.organisation_id = (select id from rbac2_ids where key = 'organisation')
        and grant_row.grantee_membership_id = (select id from rbac2_ids where key = 'subject_membership')
        and role_row.module_responsibility_key = 'suggestions'
        and grant_row.status = 'active'
      limit 1
    ),
    'rbac2 test revocation'
  ) is not null,
  'revoke Suggestions responsibility grant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000002","email":"rbac2-subject@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'subject re-selects organisation after revocation'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'suggestions.review',
    null,
    (select id from rbac2_ids where key = 'child_unit')
  ),
  'revoked Suggestions responsibility fails immediately'
);

select ok(
  public.member_has_permission('suggestions.submit'),
  'revoked management grant does not remove baseline suggestion submit'
);

select ok(
  not private.membership_has_baseline_participation(
    (select id from rbac2_ids where key = 'inactive_membership'),
    (select id from rbac2_ids where key = 'organisation'),
    'suggestions.submit',
    null,
    null
  ),
  'inactive membership denied baseline participation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000001","email":"rbac2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'owner selects organisation for custom role compatibility'
);

insert into rbac2_ids (key, id)
select 'admin_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from rbac2_ids where key = 'organisation')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

insert into rbac2_ids (key, id)
select 'custom_role_version', public.create_role_draft(
  (select id from rbac2_ids where key = 'organisation'),
  'custom-rbac2-role',
  'Custom RBAC2 Role',
  'Custom role compatibility test'
);

select ok(
  public.add_role_permission(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'custom_role_version'),
    'actions.read'
  ),
  'custom role draft accepts permission'
);

select ok(
  public.publish_role_version(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'custom_role_version')
  ),
  'custom role publishes successfully'
);

select ok(
  public.grant_role_version(
    (select id from rbac2_ids where key = 'organisation'),
    (select id from rbac2_ids where key = 'subject_membership'),
    (select id from rbac2_ids where key = 'custom_role_version'),
    'organisation',
    null
  ) is not null,
  'custom role grant remains compatible'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000002","email":"rbac2-subject@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'subject selects organisation for self-escalation attempt'
);

select throws_ok(
  $$
    select public.grant_role_version(
      (select id from rbac2_ids where key = 'organisation'),
      (select id from rbac2_ids where key = 'subject_membership'),
      (select id from rbac2_ids where key = 'admin_role_version'),
      'organisation',
      null
    )
  $$,
  '42501',
  'role delegation is not authorised',
  'subject cannot self-escalate to admin responsibility'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"9d000000-0000-0000-0000-000000000001","email":"rbac2-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from rbac2_ids where key = 'organisation')),
  'owner selects organisation for profile metadata checks'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_membership_administration_profile(
        (select id from rbac2_ids where key = 'subject_membership')
      ) -> 'access_grants'
    ) grant_row
    where grant_row ->> 'module_responsibility_key' = 'projects'
  ),
  'membership profile exposes module responsibility metadata'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer_row
    where offer_row ->> 'module_responsibility_key' = 'suggestions'
      and offer_row ->> 'responsibility_kind' = 'module'
  ),
  'delegation picker includes module responsibility offers'
);

select * from finish();
rollback;
