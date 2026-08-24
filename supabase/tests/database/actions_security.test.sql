begin;

select plan(6);

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
    '61000000-0000-0000-0000-000000000001',
    'action-owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    'action-owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table action_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on action_ids to authenticated;

insert into action_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '61000000-0000-0000-0000-000000000001',
      'action-tenant-a',
      'Action Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '61000000-0000-0000-0000-000000000002',
      'action-tenant-b',
      'Action Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"62000000-0000-0000-0000-000000000001","email":"action-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from action_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

insert into action_ids (key, id)
select 'action_a', public.create_action('Tenant A action');

select is(
  (select count(*) from public.actions),
  1::bigint,
  'tenant A owner can read created action'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"62000000-0000-0000-0000-000000000002","email":"action-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from action_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

select is(
  (select count(*) from public.actions),
  0::bigint,
  'tenant B cannot read tenant A actions'
);

select throws_ok(
  format(
    $query$
      select public.create_action(
        'Cross-tenant source',
        null,
        'normal',
        null,
        %L::uuid
      )
    $query$,
    (select id from action_ids where key = 'action_a')
  ),
  '42501',
  null,
  'cross-tenant source resource references are rejected'
);

select ok(
  to_regclass('public.action_status_transitions') is not null,
  'action transition history exists'
);

reset role;

select * from finish();
rollback;
