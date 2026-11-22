begin;

select plan(38);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'multi-grant-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'multi-grant-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'multi-grant-admin@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    'multi-grant-retired@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000005',
    'multi-grant-expired@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000006',
    'multi-grant-authority@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table multi_grant_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on multi_grant_ids to authenticated, postgres;

insert into multi_grant_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd1000000-0000-0000-0000-000000000001',
    'multi-grant-org',
    'Multi Grant Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000006', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from multi_grant_ids where key = 'organisation'),
  'd1000000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'd1000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000003',
  'd1000000-0000-0000-0000-000000000004',
  'd1000000-0000-0000-0000-000000000005',
  'd1000000-0000-0000-0000-000000000006'
);

insert into multi_grant_ids (key, id)
select 'owner_membership', id
from public.organisation_memberships
where organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and user_id = 'd1000000-0000-0000-0000-000000000001';

insert into multi_grant_ids (key, id)
select 'admin_membership', id
from public.organisation_memberships
where organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and user_id = 'd1000000-0000-0000-0000-000000000003';

insert into multi_grant_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into multi_grant_ids (key, id)
select 'suggestions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and role_row.canonical_name = 'responsibility-suggestions'
  and role_version.status = 'published';

insert into multi_grant_ids (key, id)
select 'contributor_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and role_row.canonical_name = 'suggestions-contributor'
  and role_version.status = 'published';

insert into multi_grant_ids (key, id)
select 'administrator_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from multi_grant_ids where key = 'organisation')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

select ok(
  exists (
    select 1
    from public.role_permissions permission
    where permission.organisation_id = (select id from multi_grant_ids where key = 'organisation')
      and permission.role_version_id = (select id from multi_grant_ids where key = 'contributor_role_version')
      and permission.permission_key = 'suggestions.submit'
  ),
  'suggestions contributor can submit suggestions'
);

select ok(
  not exists (
    select 1
    from public.role_permissions permission
    where permission.organisation_id = (select id from multi_grant_ids where key = 'organisation')
      and permission.role_version_id = (select id from multi_grant_ids where key = 'contributor_role_version')
      and permission.permission_key in (
        'suggestions.read',
        'suggestions.review',
        'suggestions.manage',
        'suggestions.programmes.manage'
      )
  ),
  'suggestions contributor does not review or manage the portfolio'
);

select ok(
  not exists (
    select 1
    from public.role_permissions permission
    where permission.organisation_id = (select id from multi_grant_ids where key = 'organisation')
      and permission.role_version_id = (select id from multi_grant_ids where key = 'suggestions_role_version')
      and permission.permission_key = 'suggestions.submit'
  ),
  'existing suggestions role does not gain submission permission'
);

select ok(
  exists (
    select 1
    from public.role_permissions permission
    where permission.organisation_id = (select id from multi_grant_ids where key = 'organisation')
      and permission.role_version_id = (select id from multi_grant_ids where key = 'team_member_role_version')
      and permission.permission_key = 'five_s.audit.perform'
  ),
  'team member keeps participation permissions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"multi-grant-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from multi_grant_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into multi_grant_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from multi_grant_ids where key = 'organisation'),
  null,
  'site-a',
  'Site A',
  'site'
);

insert into multi_grant_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from multi_grant_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into multi_grant_ids (key, id)
select 'line_a', public.create_organisation_unit(
  (select id from multi_grant_ids where key = 'organisation'),
  (select id from multi_grant_ids where key = 'site_a'),
  'line-a',
  'Line A',
  'line'
);

insert into multi_grant_ids (key, id)
select 'line_b', public.create_organisation_unit(
  (select id from multi_grant_ids where key = 'organisation'),
  (select id from multi_grant_ids where key = 'site_b'),
  'line-b',
  'Line B',
  'line'
);

insert into multi_grant_ids (key, id)
select 'view_role_version', public.create_role_draft(
  (select id from multi_grant_ids where key = 'organisation'),
  'site-hierarchy-viewer',
  'Site Hierarchy Viewer',
  'Read hierarchy in one site'
);

select ok(
  public.add_role_permission(
    (select id from multi_grant_ids where key = 'organisation'),
    (select id from multi_grant_ids where key = 'view_role_version'),
    'hierarchy.read'
  ),
  'site hierarchy viewer receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from multi_grant_ids where key = 'organisation'),
    (select id from multi_grant_ids where key = 'view_role_version')
  ),
  'site hierarchy viewer publishes'
);

insert into multi_grant_ids (key, id)
select 'retire_role_version', public.create_role_draft(
  (select id from multi_grant_ids where key = 'organisation'),
  'retiring-viewer',
  'Retiring Viewer',
  'Role used to prove retired grants are rejected'
);

select ok(
  public.add_role_permission(
    (select id from multi_grant_ids where key = 'organisation'),
    (select id from multi_grant_ids where key = 'retire_role_version'),
    'hierarchy.read'
  ),
  'retiring viewer receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from multi_grant_ids where key = 'organisation'),
    (select id from multi_grant_ids where key = 'retire_role_version')
  ),
  'retiring viewer publishes'
);

insert into multi_grant_ids (key, id)
select 'invitation', public.issue_organisation_member_invitation_grants(
  'email',
  'multi-grant-invitee@example.test',
  decode(repeat('11', 32), 'hex'),
  statement_timestamp() + private.invitation_default_ttl(),
  jsonb_build_array(
    jsonb_build_object(
      'role_version_id', (select id from multi_grant_ids where key = 'team_member_role_version'),
      'scope_type', 'unit_subtree',
      'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
    ),
    jsonb_build_object(
      'role_version_id', (select id from multi_grant_ids where key = 'view_role_version'),
      'scope_type', 'unit_subtree',
      'scope_unit_id', (select id from multi_grant_ids where key = 'site_b')
    )
  ),
  'Multi Grant Invitee'
);

select is(
  (
    select count(*)::int
    from public.organisation_invitation_grants grant_row
    where grant_row.invitation_id = (select id from multi_grant_ids where key = 'invitation')
  ),
  2,
  'one invitation stores both role and scope grants'
);

select is(
  jsonb_array_length(
    public.preview_organisation_invitation(decode(repeat('11', 32), 'hex')) -> 'grants'
  ),
  2,
  'invitation preview lists every grant'
);

select is(
  public.preview_organisation_invitation(decode(repeat('11', 32), 'hex')) ->> 'intended_display_name',
  'Multi Grant Invitee',
  'invitation preview keeps the invited name'
);

select throws_ok(
  $q$
    select public.issue_organisation_member_invitation_grants(
      'email',
      'multi-grant-duplicate@example.test',
      decode(repeat('22', 32), 'hex'),
      statement_timestamp() + private.invitation_default_ttl(),
      jsonb_build_array(
        jsonb_build_object(
          'role_version_id', (select id from multi_grant_ids where key = 'view_role_version'),
          'scope_type', 'unit_subtree',
          'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
        ),
        jsonb_build_object(
          'role_version_id', (select id from multi_grant_ids where key = 'view_role_version'),
          'scope_type', 'unit_subtree',
          'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
        )
      )
    )
  $q$,
  '22023',
  'invitation contains a duplicate role and scope',
  'duplicate role and scope is rejected'
);

select is(
  (
    select count(*)::int
    from public.organisation_invitations invitation
    where invitation.canonical_recipient = 'multi-grant-duplicate@example.test'
  ),
  0,
  'duplicate rejection does not leave an invitation'
);

select throws_ok(
  $q$
    select public.issue_organisation_member_invitation_grants(
      'email',
      'multi-grant-invalid@example.test',
      decode(repeat('33', 32), 'hex'),
      statement_timestamp() + private.invitation_default_ttl(),
      jsonb_build_array(
        jsonb_build_object(
          'role_version_id', (select id from multi_grant_ids where key = 'team_member_role_version'),
          'scope_type', 'unit_subtree',
          'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
        ),
        jsonb_build_object(
          'role_version_id', (select id from multi_grant_ids where key = 'team_member_role_version'),
          'scope_type', 'organisation',
          'scope_unit_id', null
        )
      )
    )
  $q$,
  '42501',
  'role scope is not permitted for this role',
  'an invalid grant rejects the whole invitation'
);

select is(
  (
    select count(*)::int
    from public.organisation_invitations invitation
    where invitation.canonical_recipient = 'multi-grant-invalid@example.test'
  ),
  0,
  'invalid grant combination does not provision a partial invitation'
);

insert into multi_grant_ids (key, id)
select 'replacement', public.reissue_organisation_member_invitation(
  (select id from multi_grant_ids where key = 'invitation'),
  decode(repeat('44', 32), 'hex'),
  statement_timestamp() + private.invitation_default_ttl()
);

select is(
  (
    select count(*)::int
    from public.organisation_invitation_grants grant_row
    where grant_row.invitation_id = (select id from multi_grant_ids where key = 'replacement')
  ),
  2,
  'reissue preserves every grant'
);

select is(
  (
    select provisioning.intended_display_name
    from public.organisation_invitation_provisioning provisioning
    where provisioning.invitation_id = (select id from multi_grant_ids where key = 'replacement')
  ),
  'Multi Grant Invitee',
  'reissue preserves the invited name'
);

select is(
  (
    select invitation.status
    from public.organisation_invitations invitation
    where invitation.id = (select id from multi_grant_ids where key = 'invitation')
  ),
  'revoked',
  'reissue retires the source invitation'
);

insert into multi_grant_ids (key, id)
select 'single_invitation', public.issue_organisation_member_invitation(
  'email',
  'multi-grant-single@example.test',
  decode(repeat('55', 32), 'hex'),
  statement_timestamp() + private.invitation_default_ttl(),
  (select id from multi_grant_ids where key = 'team_member_role_version'),
  'unit_subtree',
  (select id from multi_grant_ids where key = 'site_a'),
  'Single Grant Invitee'
);

select is(
  (
    select count(*)::int
    from public.organisation_invitation_grants grant_row
    where grant_row.invitation_id = (select id from multi_grant_ids where key = 'single_invitation')
  ),
  1,
  'existing single-role invitations still store one grant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000002","email":"multi-grant-invitee@example.test"}',
  true
);

insert into multi_grant_ids (key, id)
select 'accepted_membership', public.accept_organisation_invitation(
  decode(repeat('44', 32), 'hex')
);

select is(
  public.accept_organisation_invitation(decode(repeat('44', 32), 'hex')),
  (select id from multi_grant_ids where key = 'accepted_membership'),
  'accepting the same invitation again returns the existing membership'
);

set local role postgres;

select is(
  (
    select membership.display_name
    from public.organisation_memberships membership
    where membership.id = (select id from multi_grant_ids where key = 'accepted_membership')
  ),
  'Multi Grant Invitee',
  'acceptance applies the invited name to a blank membership'
);

select is(
  (
    select count(*)::int
    from public.access_grants grant_row
    where grant_row.grantee_membership_id = (
      select id from multi_grant_ids where key = 'accepted_membership'
    )
      and grant_row.status = 'active'
  ),
  2,
  'repeated acceptance does not duplicate grants'
);

select ok(
  private.membership_has_scoped_permission(
    (select id from multi_grant_ids where key = 'accepted_membership'),
    (select id from multi_grant_ids where key = 'organisation'),
    'five_s.audit.perform',
    null,
    (select id from multi_grant_ids where key = 'line_a')
  ),
  'team member permission applies inside site A'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from multi_grant_ids where key = 'accepted_membership'),
    (select id from multi_grant_ids where key = 'organisation'),
    'five_s.audit.perform',
    null,
    (select id from multi_grant_ids where key = 'line_b')
  ),
  'a view grant at site B does not expand the site A permission'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"multi-grant-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from multi_grant_ids where key = 'organisation')),
  'owner returns to the organisation'
);

insert into multi_grant_ids (key, id)
select 'retired_invitation', public.issue_organisation_member_invitation_grants(
  'email',
  'multi-grant-retired@example.test',
  decode(repeat('66', 32), 'hex'),
  statement_timestamp() + private.invitation_default_ttl(),
  jsonb_build_array(
    jsonb_build_object(
      'role_version_id', (select id from multi_grant_ids where key = 'retire_role_version'),
      'scope_type', 'unit_subtree',
      'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
    )
  ),
  'Retired Role Invitee'
);

set local role postgres;

update public.role_versions
set status = 'retired',
    retired_at = statement_timestamp(),
    retired_by_membership_id = (select id from multi_grant_ids where key = 'owner_membership')
where id = (select id from multi_grant_ids where key = 'retire_role_version');

set local role authenticated;

select throws_ok(
  $q$
    select public.reissue_organisation_member_invitation(
      (select id from multi_grant_ids where key = 'retired_invitation'),
      decode(repeat('77', 32), 'hex'),
      statement_timestamp() + private.invitation_default_ttl()
    )
  $q$,
  '42501',
  'invitation authority is no longer delegable',
  'reissue rejects a retired role'
);

select is(
  (
    select invitation.status
    from public.organisation_invitations invitation
    where invitation.id = (select id from multi_grant_ids where key = 'retired_invitation')
  ),
  'pending',
  'failed reissue leaves the source invitation pending'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000004","email":"multi-grant-retired@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('66', 32), 'hex')) $q$,
  '42501',
  'invitation authority is no longer delegable',
  'acceptance rejects a retired role'
);

set local role postgres;

select is(
  (
    select invitation.status
    from public.organisation_invitations invitation
    where invitation.id = (select id from multi_grant_ids where key = 'retired_invitation')
  ),
  'pending',
  'failed acceptance leaves the invitation pending'
);

set local role postgres;

insert into public.organisation_invitations (
  organisation_id,
  recipient_type,
  canonical_recipient,
  token_digest,
  inviter_membership_id,
  expires_at,
  created_at
)
values (
  (select id from multi_grant_ids where key = 'organisation'),
  'email',
  'multi-grant-expired@example.test',
  decode(repeat('88', 32), 'hex'),
  (select id from multi_grant_ids where key = 'owner_membership'),
  statement_timestamp() - interval '1 minute',
  statement_timestamp() - interval '2 minutes'
);

insert into public.organisation_invitation_grants (
  organisation_id,
  invitation_id,
  role_version_id,
  scope_type,
  scope_unit_id
)
select
  invitation.organisation_id,
  invitation.id,
  (select id from multi_grant_ids where key = 'view_role_version'),
  'unit_subtree',
  (select id from multi_grant_ids where key = 'site_a')
from public.organisation_invitations invitation
where invitation.token_digest = decode(repeat('88', 32), 'hex');

update public.organisation_invitations
set offer_sealed_at = statement_timestamp() - interval '2 minutes'
where token_digest = decode(repeat('88', 32), 'hex');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000005","email":"multi-grant-expired@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('88', 32), 'hex')) $q$,
  '42501',
  'invitation is unavailable',
  'expired invitation cannot be accepted'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"multi-grant-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from multi_grant_ids where key = 'organisation')),
  'owner selects organisation before delegating an administrator'
);

insert into multi_grant_ids (key, id)
select 'admin_grant', public.grant_role_version(
  (select id from multi_grant_ids where key = 'organisation'),
  (select id from multi_grant_ids where key = 'admin_membership'),
  (select id from multi_grant_ids where key = 'administrator_role_version'),
  'organisation',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000003","email":"multi-grant-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from multi_grant_ids where key = 'organisation')),
  'administrator selects organisation'
);

insert into multi_grant_ids (key, id)
select 'authority_invitation', public.issue_organisation_member_invitation_grants(
  'email',
  'multi-grant-authority@example.test',
  decode(repeat('99', 32), 'hex'),
  statement_timestamp() + private.invitation_default_ttl(),
  jsonb_build_array(
    jsonb_build_object(
      'role_version_id', (select id from multi_grant_ids where key = 'team_member_role_version'),
      'scope_type', 'unit_subtree',
      'scope_unit_id', (select id from multi_grant_ids where key = 'site_a')
    )
  ),
  'Authority Invitee'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"multi-grant-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from multi_grant_ids where key = 'organisation')),
  'owner returns to revoke administrator authority'
);

select ok(
  public.revoke_access_grant(
    (select id from multi_grant_ids where key = 'organisation'),
    (select id from multi_grant_ids where key = 'admin_grant'),
    'Delegator authority removed'
  ),
  'owner revokes the administrator grant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000003","email":"multi-grant-admin@example.test"}',
  true
);

select throws_ok(
  $q$
    select public.reissue_organisation_member_invitation(
      (select id from multi_grant_ids where key = 'authority_invitation'),
      decode(repeat('aa', 32), 'hex'),
      statement_timestamp() + private.invitation_default_ttl()
    )
  $q$,
  '42501',
  'invitation reissue is not authorised',
  'reissue fails after the inviter loses authority'
);

set local role postgres;

select is(
  (
    select invitation.status
    from public.organisation_invitations invitation
    where invitation.id = (select id from multi_grant_ids where key = 'authority_invitation')
  ),
  'pending',
  'lost inviter authority does not revoke the pending invitation'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000006","email":"multi-grant-authority@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('99', 32), 'hex')) $q$,
  '42501',
  'invitation authority is no longer manageable',
  'acceptance fails after the inviter loses authority'
);

select * from finish();
rollback;
