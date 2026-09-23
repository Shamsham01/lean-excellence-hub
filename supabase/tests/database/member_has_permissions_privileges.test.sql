begin;

select plan(4);

-- Anonymous role must not execute the batch permission probe.
set local role anon;

select throws_ok(
  $$ select public.member_has_permissions(array['suggestions.read']) $$,
  '42501',
  null,
  'anonymous callers cannot execute member_has_permissions'
);

reset role;

-- Authenticated callers retain execute and parity with single-key probe.
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
values (
  'a1000000-0000-0000-0000-000000000001',
  'batch-priv-owner@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table batch_priv_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on batch_priv_ids to authenticated;

insert into batch_priv_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1000000-0000-0000-0000-000000000001',
    'batch-priv-org',
    'Batch Priv Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a2000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a2000000-0000-0000-0000-000000000001","email":"batch-priv-owner@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from batch_priv_ids where key = 'organisation')),
  'owner selects organisation for batch privilege checks'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.member_has_permissions(text[])',
    'EXECUTE'
  ),
  'authenticated role retains EXECUTE on member_has_permissions'
);

select is(
  public.member_has_permission('workforce.provision'),
  (public.member_has_permissions(array['workforce.provision'])->>'workforce.provision')::boolean,
  'batch probe parity holds after anon revoke migration'
);

select * from finish();

rollback;
