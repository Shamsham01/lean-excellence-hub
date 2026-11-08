begin;

select plan(5);

select ok(
  exists (
    select 1
    from storage.buckets bucket_row
    where bucket_row.id = 'profile-avatars'
      and bucket_row.public is true
      and bucket_row.file_size_limit = 2097152
  ),
  'profile-avatars bucket exists with a 2MB public limit'
);

select ok(
  exists (
    select 1
    from pg_policies policy_row
    where policy_row.schemaname = 'storage'
      and policy_row.tablename = 'objects'
      and policy_row.policyname = 'Users can read their own profile avatar objects'
      and policy_row.roles::text[] @> array['authenticated']
  ),
  'profile avatar select policy is limited to authenticated'
);

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
    'c1000000-0000-0000-0000-000000000001',
    'profile-avatar-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'profile-avatar-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"profile-avatar-a@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into storage.objects (
      bucket_id,
      name,
      owner,
      metadata
    )
    values (
      'profile-avatars',
      'c1000000-0000-0000-0000-000000000001/avatar.png',
      'c1000000-0000-0000-0000-000000000001',
      '{"mimetype":"image/png"}'::jsonb
    )
  $$,
  'user can upload into their own avatar folder'
);

select throws_ok(
  $$
    insert into storage.objects (
      bucket_id,
      name,
      owner,
      metadata
    )
    values (
      'profile-avatars',
      'c1000000-0000-0000-0000-000000000002/avatar.png',
      'c1000000-0000-0000-0000-000000000001',
      '{"mimetype":"image/png"}'::jsonb
    )
  $$,
  '42501',
  null,
  'user cannot upload into another member folder'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

select is(
  (
    select count(*)::int
    from storage.objects
    where bucket_id = 'profile-avatars'
  ),
  0,
  'anonymous callers cannot list profile-avatars objects'
);

select * from finish();
rollback;
