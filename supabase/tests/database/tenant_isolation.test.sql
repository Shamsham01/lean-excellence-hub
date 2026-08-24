begin;

select plan(25);

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
    '10000000-0000-0000-0000-000000000001',
    'owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'opaque-workforce@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select on test_ids to anon, authenticated, service_role;

insert into test_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '10000000-0000-0000-0000-000000000001',
      'tenant-a',
      'Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '10000000-0000-0000-0000-000000000002',
      'tenant-b',
      'Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.organisations'::regclass
  ),
  'organisations enforce RLS'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.access_grants'::regclass
  ),
  'access grants enforce RLS'
);

set local role anon;
select throws_ok(
  'select * from public.organisations',
  '42501',
  null,
  'anonymous callers cannot read organisations'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"20000000-0000-0000-0000-000000000001","email":"owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from test_ids where key = 'org_a')
  ),
  'an active member can select its organisation'
);

select is(
  (select count(*) from public.organisations),
  1::bigint,
  'selected tenant limits organisation visibility'
);

select is(
  (select code from public.organisations),
  'tenant-a',
  'selected tenant cannot read another organisation'
);

select is(
  public.switch_organisation(
    (select id from test_ids where key = 'org_b')
  ),
  false,
  'a user cannot switch to another tenant without membership'
);

select is(
  (
    select count(*)
    from public.organisation_memberships
    where organisation_id = (select id from test_ids where key = 'org_b')
  ),
  0::bigint,
  'cross-tenant memberships are hidden'
);

select throws_ok(
  'select token_digest from public.organisation_invitations',
  '42501',
  null,
  'authenticated callers cannot retrieve invitation token digests'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"20000000-0000-0000-0000-000000000002","email":"owner-a@example.test"}',
  true
);
set local role authenticated;
select is(
  private.current_session_id(),
  null::uuid,
  'a session claim belonging to another user is rejected'
);
reset role;

set local role service_role;
select throws_ok(
  'select * from public.organisations',
  '42501',
  null,
  'service role has no direct tenant-table read privilege'
);
select throws_ok(
  'select * from private.workforce_accounts',
  '42501',
  null,
  'service role has no direct private-table read privilege'
);
reset role;

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
select
  id,
  '10000000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
from test_ids
where key in ('org_a', 'org_b');

insert into test_ids (key, id)
select
  case organisation.code
    when 'tenant-a' then 'shared_membership_a'
    else 'shared_membership_b'
  end,
  membership.id
from public.organisation_memberships membership
join public.organisations organisation
  on organisation.id = membership.organisation_id
where membership.user_id = '10000000-0000-0000-0000-000000000003';

set local role service_role;
select lives_ok(
  format(
    $query$
      select *
      from public.provision_workforce_identity(
        %L::uuid,
        (select id from test_ids where key = 'shared_membership_a'),
        '10000000-0000-0000-0000-000000000003',
        '10000000000000000000000000000003@workforce.invalid',
        'workforce_id',
        'worker-003'
      )
    $query$,
    (select id from test_ids where key = 'org_a')
  ),
  'service operation provisions the first workforce alias'
);

select lives_ok(
  format(
    $query$
      select *
      from public.provision_workforce_identity(
        %L::uuid,
        (select id from test_ids where key = 'shared_membership_b'),
        '10000000-0000-0000-0000-000000000003',
        null,
        'workforce_id',
        'worker-003-b'
      )
    $query$,
    (select id from test_ids where key = 'org_b')
  ),
  'a second tenant alias reuses the global workforce account'
);

select is(
  (
    select count(*)
    from public.resolve_workforce_login('tenant-a', 'worker-003')
  ),
  1::bigint,
  'trusted workforce resolution returns an active account'
);

select is(
  (
    select count(*)
    from public.resolve_workforce_login('tenant-a', 'unknown-worker')
  ),
  0::bigint,
  'unknown workforce aliases disclose no account'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"20000000-0000-0000-0000-000000000003","email":"opaque-workforce@example.test"}',
  true
);
set local role authenticated;
select is(
  public.current_workforce_login_identifier(),
  '10000000000000000000000000000003@workforce.invalid',
  'an authenticated workforce account owner may view its own identifier'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"20000000-0000-0000-0000-000000000001","email":"owner-a@example.test"}',
  true
);
set local role authenticated;
select is(
  public.current_workforce_login_identifier(),
  null::text,
  'an authenticated user cannot discover another workforce identifier'
);
reset role;

set local role service_role;
select is(
  public.disable_workforce_identity(
    '10000000-0000-0000-0000-000000000003',
    'Security disablement test'
  ),
  1,
  'global workforce disablement revokes the active session'
);

select is(
  (
    select count(*)
    from public.resolve_workforce_login('tenant-a', 'worker-003')
  ),
  0::bigint,
  'disabled workforce identities cannot be resolved for login'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"20000000-0000-0000-0000-000000000003","email":"opaque-workforce@example.test"}',
  true
);
set local role authenticated;
select is(
  private.current_session_id(),
  null::uuid,
  'disabled workforce session tokens fail closed after revocation'
);
reset role;

set local role service_role;
select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('ab', 32), 'hex'),
    1,
    300,
    900
  ),
  'the first authentication attempt is allowed'
);

select is(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('ab', 32), 'hex'),
    1,
    300,
    900
  ),
  false,
  'the atomic limiter blocks attempts beyond the threshold'
);
reset role;

select throws_ok(
  $query$
    update public.security_audit_events
    set metadata = '{"tampered":true}'::jsonb
    where organisation_id = (select id from test_ids where key = 'org_a')
  $query$,
  '55000',
  null,
  'security audit events are append-only'
);

select throws_ok(
  $query$
    update public.role_versions
    set version_number = 2
    where organisation_id = (select id from test_ids where key = 'org_a')
      and status = 'published'
  $query$,
  '55000',
  null,
  'published role-version identity is immutable'
);

select * from finish();
rollback;
