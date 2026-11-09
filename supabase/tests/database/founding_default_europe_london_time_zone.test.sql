begin;

select plan(2);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'founder-london-tz@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'f4000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('founder-london-tz@example.test'),
    'f3000000-0000-4000-8000-000000000001'
  ),
  'founder receives founding capability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f4000000-0000-4000-8000-000000000001","email":"founder-london-tz@example.test"}',
  true
);
set local role authenticated;

create temporary table founder_london_org (id uuid not null) on commit drop;

select lives_ok(
  $$insert into founder_london_org (id) values (
    public.create_founding_organisation(
      'London TZ Org', 'GB', 'en-GB', '   ', 'GBP', 'First Site', 1, 'fake', 'not_sure'
    )
  )$$,
  'founding succeeds with blank time zone'
);

select is(
  (select time_zone from public.organisations where id = (select id from founder_london_org)),
  'Europe/London',
  'blank founding time zone stores Europe/London'
);

select * from finish();
rollback;
