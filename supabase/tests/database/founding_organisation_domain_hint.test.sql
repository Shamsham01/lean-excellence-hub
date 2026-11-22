begin;

select plan(10);

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
    'd1000000-0000-4000-8000-000000000001',
    'incumbent@acme.example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'founder@acme.example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'd1000000-0000-4000-8000-000000000003',
    'founder@gmail.com',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'd1000000-0000-4000-8000-000000000004',
    'solo@other.example.test',
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
    'd2000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd2000000-0000-4000-8000-000000000003',
    'd1000000-0000-4000-8000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd2000000-0000-4000-8000-000000000004',
    'd1000000-0000-4000-8000-000000000004',
    statement_timestamp(),
    statement_timestamp()
  );

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('incumbent@acme.example.test'),
    'd1000000-0000-4000-8000-000000000001'
  ),
  'incumbent can receive founding capability for organisation setup'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"d2000000-0000-4000-8000-000000000001","email":"incumbent@acme.example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.create_founding_organisation(
    'Acme Existing Org',
    'GB',
    'en-GB',
    'UTC',
    'GBP',
    'Acme Site',
    1,
    'fake'
  )$$,
  'incumbent can create the existing organisation'
);

reset role;
set local role postgres;

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('founder@acme.example.test'),
    'd1000000-0000-4000-8000-000000000002'
  ),
  'second founder at same domain receives founding capability'
);

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('founder@gmail.com'),
    'd1000000-0000-4000-8000-000000000003'
  ),
  'public-domain founder receives founding capability'
);

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('solo@other.example.test'),
    'd1000000-0000-4000-8000-000000000004'
  ),
  'unrelated founder receives founding capability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"d2000000-0000-4000-8000-000000000002","email":"founder@acme.example.test"}',
  true
);
set local role authenticated;

select is(
  public.current_founding_organisation_domain_hint() ->> 'state',
  'possible_existing_organisation',
  'matching corporate domain returns a generic hint only'
);

select cmp_ok(
  (
    select count(*)::integer
    from jsonb_object_keys(
      coalesce(public.current_founding_organisation_domain_hint(), '{}'::jsonb)
    ) key_name
  ),
  '=',
  1,
  'hint payload exposes only the state field'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"d2000000-0000-4000-8000-000000000003","email":"founder@gmail.com"}',
  true
);

select is(
  public.current_founding_organisation_domain_hint() ->> 'state',
  'none',
  'public email domains never receive a domain hint'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"d2000000-0000-4000-8000-000000000004","email":"solo@other.example.test"}',
  true
);

select is(
  public.current_founding_organisation_domain_hint() ->> 'state',
  'none',
  'unrelated corporate domain does not hint'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.current_founding_organisation_domain_hint()$$,
  '42501',
  'permission denied for function current_founding_organisation_domain_hint',
  'anonymous callers cannot evaluate founding organisation hints'
);

select * from finish();
rollback;
