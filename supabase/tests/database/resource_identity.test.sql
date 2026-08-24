begin;

select plan(4);

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
  '51000000-0000-0000-0000-000000000001',
  'resource-owner@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table resource_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select on resource_ids to authenticated, service_role;

insert into resource_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '51000000-0000-0000-0000-000000000001',
    'resource-org',
    'Resource Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '52000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role authenticated;

select throws_ok(
  'select * from public.resource_records',
  '42501',
  null,
  'resource registry is not directly readable by authenticated callers'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000001","email":"resource-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from resource_ids where key = 'organisation')
  ),
  'resource test member can select organisation'
);

select lives_ok(
  $query$
    select public.create_action('Registry smoke action')
  $query$,
  'controlled action creation registers a resource record indirectly'
);

select throws_ok(
  format(
    $query$
      select public.create_action(
        'Bad source action',
        null,
        'normal',
        null,
        %L::uuid
      )
    $query$,
    gen_random_uuid()
  ),
  '42501',
  null,
  'unknown source resource ids are rejected'
);

reset role;

select * from finish();
rollback;
