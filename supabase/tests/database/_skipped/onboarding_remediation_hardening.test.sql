begin;

select plan(15);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    'hardening-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    'hardening-subtree@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    'hardening-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table hardening_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on hardening_ids to authenticated;

insert into hardening_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93000000-0000-0000-0000-000000000001',
    'hardening-org',
    'Hardening Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    '93000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '93000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000001","email":"hardening-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from hardening_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into hardening_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from hardening_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into hardening_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from hardening_ids where key = 'organisation'),
  (select id from hardening_ids where key = 'root_unit'),
  'packing',
  'Packing',
  'department'
);

insert into hardening_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from hardening_ids where key = 'organisation'),
  (select id from hardening_ids where key = 'root_unit'),
  'production',
  'Production',
  'department'
);

insert into hardening_ids (key, id)
select 'job_function', public.create_job_function('Team Leader', 'team-leader');

insert into hardening_ids (key, id)
select 'provision_job_function', public.create_job_function(
  'Provisioning Role',
  'provisioning-role'
);

insert into hardening_ids (key, id)
select 'delegate_role_draft', public.create_role_draft(
  (select id from hardening_ids where key = 'organisation'),
  'subtree-delegate',
  'Subtree Delegate',
  'Unit scoped delegate'
);

select ok(
  public.add_role_permission(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'delegate_role_draft'),
    'roles.delegate'
  ),
  'subtree delegate role receives roles.delegate'
);

select ok(
  public.add_role_permission(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'delegate_role_draft'),
    'job_functions.manage'
  ),
  'subtree delegate role receives job_functions.manage'
);

select ok(
  public.add_role_permission(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'delegate_role_draft'),
    'hierarchy.read'
  ),
  'subtree delegate role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'delegate_role_draft')
  ),
  'subtree delegate role publishes'
);

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from hardening_ids where key = 'organisation'),
  '93000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

insert into hardening_ids (key, id)
select 'subtree_membership', id
from public.organisation_memberships
where user_id = '93000000-0000-0000-0000-000000000002';

insert into hardening_ids (key, id)
select 'subtree_grant', public.grant_role_version(
  (select id from hardening_ids where key = 'organisation'),
  (select id from hardening_ids where key = 'subtree_membership'),
  (select id from hardening_ids where key = 'delegate_role_draft'),
  'unit_subtree',
  (select id from hardening_ids where key = 'child_unit')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000002","email":"hardening-subtree@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from hardening_ids where key = 'organisation')),
  'subtree delegate selects organisation'
);

select throws_ok(
  format(
    $f$
      select public.assign_membership_job_function(
        %L::uuid,
        %L::uuid,
        true,
        %L::uuid
      )
    $f$,
    (select id from hardening_ids where key = 'subtree_membership'),
    (select id from hardening_ids where key = 'job_function'),
    (select id from hardening_ids where key = 'sibling_unit')
  ),
  '42501',
  null,
  'direct RPC assignment outside hierarchy.read scope fails'
);

select ok(
  public.assign_membership_job_function(
    (select id from hardening_ids where key = 'subtree_membership'),
    (select id from hardening_ids where key = 'job_function'),
    true,
    (select id from hardening_ids where key = 'child_unit')
  ) is not null,
  'unit-scoped manager can assign within permitted subtree'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000001","email":"hardening-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from hardening_ids where key = 'organisation')),
  'owner reselects organisation before invitation provisioning checks'
);

insert into hardening_ids (key, id)
select 'member_role_draft', public.create_role_draft(
  (select id from hardening_ids where key = 'organisation'),
  'invited-member',
  'Invited Member',
  'Delegatable member role for invitation provisioning tests'
);

select ok(
  public.add_role_permission(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'member_role_draft'),
    'hierarchy.read'
  ),
  'invited member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'member_role_draft')
  ),
  'invited member role publishes'
);

insert into hardening_ids (key, id)
select 'provision_invitation', public.issue_organisation_member_invitation(
  'email',
  'hardening-invitee@example.test',
  decode(repeat('cc', 32), 'hex'),
  statement_timestamp() + interval '7 days',
  (select id from hardening_ids where key = 'member_role_draft'),
  'organisation',
  null,
  'Invitee Name',
  (select id from hardening_ids where key = 'provision_job_function'),
  (select id from hardening_ids where key = 'child_unit')
);

update public.job_functions
set status = 'inactive'
where id = (select id from hardening_ids where key = 'provision_job_function');

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000003","email":"hardening-invitee@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('cc', 32), 'hex')) $q$,
  'P0002',
  null,
  'accept fails when provisioning job function is no longer active'
);

select is(
  (
    select status
    from public.organisation_invitations
    where id = (select id from hardening_ids where key = 'provision_invitation')
  ),
  'pending',
  'invitation remains pending after failed accept'
);

select ok(
  not exists (
    select 1
    from public.organisation_memberships
    where user_id = '93000000-0000-0000-0000-000000000003'
  ),
  'failed accept does not create membership'
);

select ok(
  not exists (
    select 1
    from public.access_grants
    where grantee_membership_id in (
      select id
      from public.organisation_memberships
      where user_id = '93000000-0000-0000-0000-000000000003'
    )
  ),
  'failed accept does not create access grants'
);

select * from finish();
rollback;
