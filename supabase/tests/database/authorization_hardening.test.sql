begin;

select plan(24);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    'owner-one@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'owner-two@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'recipient@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table hardening_ids (
  key text primary key,
  id uuid not null
) on commit drop;
grant all on hardening_ids to authenticated, service_role;

insert into hardening_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '30000000-0000-0000-0000-000000000001',
    'hardening-org',
    'Hardening Organisation'
  )
);

insert into hardening_ids (key, id)
select 'owner_one_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (
    select id from hardening_ids where key = 'organisation'
  )
  and membership.user_id = '30000000-0000-0000-0000-000000000001';

insert into hardening_ids (key, id)
select 'owner_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (
    select id from hardening_ids where key = 'organisation'
  )
  and role_row.is_owner_role;

insert into hardening_ids (key, id)
select 'owner_one_grant', grant_row.id
from public.access_grants grant_row
where grant_row.organisation_id = (
    select id from hardening_ids where key = 'organisation'
  )
  and grant_row.grantee_membership_id = (
    select id from hardening_ids where key = 'owner_one_membership'
  );

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from hardening_ids where key = 'organisation'),
    '30000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into hardening_ids (key, id)
select 'owner_two_membership', id from inserted_membership;

with inserted_grant as (
  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    grantor_membership_id
  )
  values (
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'owner_two_membership'),
    (select id from hardening_ids where key = 'owner_role_version'),
    'organisation',
    (select id from hardening_ids where key = 'owner_one_membership')
  )
  returning id
)
insert into hardening_ids (key, id)
select 'owner_two_grant', id from inserted_grant;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"40000000-0000-0000-0000-000000000001","email":"owner-one@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from hardening_ids where key = 'organisation')
  ),
  'first owner selects the organisation'
);

insert into hardening_ids (key, id)
select
  'ordinary_role_draft',
  public.create_role_draft(
    (select id from hardening_ids where key = 'organisation'),
    'ordinary-security-role',
    'Ordinary Security Role',
    null
  );

select throws_ok(
  format(
    'select public.add_role_permission(%L::uuid, %L::uuid, %L)',
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'ordinary_role_draft'),
    'organisation.update'
  ),
  '42501',
  null,
  'protected permissions cannot be added to an ordinary role'
);

insert into hardening_ids (key, id)
select
  'protected_role_draft',
  public.create_protected_role_draft(
    (select id from hardening_ids where key = 'organisation'),
    'delegated-security-manager',
    'Delegated Security Manager',
    'Owner-governed protected role'
  );
select ok(
  (
    select id is not null
    from hardening_ids
    where key = 'protected_role_draft'
  ),
  'an effective owner can create a protected role draft'
);
select ok(
  public.add_role_permission(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'protected_role_draft'),
    'organisation.update'
  ),
  'a protected role may contain a protected permission'
);
select ok(
  public.publish_role_version(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'protected_role_draft')
  ),
  'an effective owner can publish a valid protected role'
);

insert into hardening_ids (key, id)
select
  'protected_invitation',
  public.issue_organisation_invitation(
    (select id from hardening_ids where key = 'organisation'),
    'email',
    'recipient@example.test',
    decode(repeat('cd', 32), 'hex'),
    statement_timestamp() + interval '1 day',
    (select id from hardening_ids where key = 'owner_role_version'),
    'organisation',
    null
  );

select ok(
  (select id is not null from hardening_ids where key = 'protected_invitation'),
  'an effective owner can issue a protected invitation'
);

insert into hardening_ids (key, id)
select
  'revocable_invitation',
  public.issue_organisation_invitation(
    (select id from hardening_ids where key = 'organisation'),
    'email',
    'unused-recipient@example.test',
    decode(repeat('ac', 32), 'hex'),
    statement_timestamp() + interval '1 day',
    (select id from hardening_ids where key = 'owner_role_version'),
    'organisation',
    null
  );

select ok(
  public.revoke_organisation_invitation(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'revocable_invitation'),
    'Invitation no longer required'
  ),
  'an authorised owner can revoke a pending invitation'
);

select is(
  (
    select status
    from public.organisation_invitations
    where id = (
      select id from hardening_ids where key = 'revocable_invitation'
    )
  ),
  'revoked',
  'revoked invitations enter a terminal lifecycle state'
);

select ok(
  public.revoke_access_grant(
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'owner_one_grant'),
    'Transfer ownership authority'
  ),
  'owner authority can be transferred while another effective owner remains'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"40000000-0000-0000-0000-000000000003","email":"recipient@example.test"}',
  true
);
set local role authenticated;
select throws_ok(
  $query$
    select public.accept_organisation_invitation(
      decode(repeat('cd', 32), 'hex')
    )
  $query$,
  '42501',
  null,
  'protected invitation acceptance fails after inviter loses ownership'
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
    (select id from hardening_ids where key = 'organisation'),
    '30000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into hardening_ids (key, id)
select 'recipient_membership', id from inserted_membership;

insert into public.access_grants (
  organisation_id,
  grantee_membership_id,
  role_version_id,
  scope_type,
  grantor_membership_id,
  granted_at,
  expires_at
)
values (
  (select id from hardening_ids where key = 'organisation'),
  (select id from hardening_ids where key = 'recipient_membership'),
  (select id from hardening_ids where key = 'owner_role_version'),
  'organisation',
  (select id from hardening_ids where key = 'owner_two_membership'),
  statement_timestamp() - interval '2 days',
  statement_timestamp() - interval '1 day'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"40000000-0000-0000-0000-000000000002","email":"owner-two@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from hardening_ids where key = 'organisation')
  ),
  'second owner selects the organisation'
);

select throws_ok(
  format(
    'select public.revoke_access_grant(%L::uuid, %L::uuid, %L)',
    (select id from hardening_ids where key = 'organisation'),
    (select id from hardening_ids where key = 'owner_two_grant'),
    'Attempt to remove final owner'
  ),
  '23514',
  null,
  'an expired owner grant does not satisfy the last-owner invariant'
);

select ok(
  public.suspend_or_close_organisation(
    (select id from hardening_ids where key = 'organisation'),
    'suspended',
    'Security review'
  ),
  'an authorised owner can suspend the organisation'
);
reset role;

select is(
  (
    select status
    from public.organisations
    where id = (select id from hardening_ids where key = 'organisation')
  ),
  'suspended',
  'suspension updates the organisation lifecycle'
);

set local role service_role;
select ok(
  public.restore_organisation(
    (select id from hardening_ids where key = 'organisation'),
    'Platform security review completed'
  ),
  'the trusted platform path can restore a suspended organisation'
);
reset role;

select is(
  (
    select status
    from public.organisations
    where id = (select id from hardening_ids where key = 'organisation')
  ),
  'active',
  'restoration returns the organisation to active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"40000000-0000-0000-0000-000000000002","email":"owner-two@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from hardening_ids where key = 'organisation')
  ),
  'the restored organisation can be selected again'
);
reset role;

set local role service_role;
select is(
  public.revoke_identity_sessions(
    '30000000-0000-0000-0000-000000000002',
    'Security session revocation test'
  ),
  1,
  'trusted revocation removes the live Auth session'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"40000000-0000-0000-0000-000000000002","email":"owner-two@example.test"}',
  true
);
set local role authenticated;
select is(
  private.current_session_id(),
  null::uuid,
  'a removed session invalidates an otherwise-unexpired token'
);
select is(
  (
    select count(*)
    from public.profiles
    where user_id = '30000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a removed session cannot read the profile exception path'
);
reset role;

set local role service_role;
select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('ef', 32), 'hex'),
    1,
    300,
    900
  ),
  'the deterministic limiter reserves the first attempt'
);
select ok(
  public.record_authentication_rate_limit_failure(
    'workforce_login',
    'alias',
    decode(repeat('ef', 32), 'hex'),
    1,
    300,
    900
  ),
  'the deterministic limiter records the failed attempt'
);
select is(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('ef', 32), 'hex'),
    1,
    300,
    900
  ),
  false,
  'the deterministic limiter rejects excess failures'
);
reset role;

select is(
  (
    select count(*)
    from private.authentication_rate_limits limiter
    where limiter.purpose = 'workforce_login'
      and limiter.dimension = 'alias'
      and limiter.key_hash = decode(repeat('ef', 32), 'hex')
  ),
  1::bigint,
  'all attempts share one deterministic rate-limit bucket'
);

select * from finish();
rollback;
