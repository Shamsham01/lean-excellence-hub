begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'planner-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'planner-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table planner_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on planner_ids to authenticated;

insert into planner_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000001',
    'planner-org',
    'Planner Org'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000002',
    'planner-outsider-org',
    'Planner Outsider Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'e1100000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'e1100000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select tests.authenticate_as('planner-owner@example.test');

select lives_ok(
  $$select public.list_action_labels()$$,
  'member can list labels in own org'
);

select throws_ok(
  $$select public.list_action_labels()$$,
  '42501',
  null,
  'anon cannot list action labels'
);

select tests.authenticate_as('planner-outsider@example.test');

select throws_ok(
  format(
    'select public.set_action_labels(%L::uuid, %L::uuid[])',
    gen_random_uuid(),
    array[]::uuid[]
  ),
  '42501',
  null,
  'outsider cannot set labels on foreign action'
);

select tests.clear_authentication();

select throws_ok(
  $$select public.list_action_labels()$$,
  '42501',
  null,
  'anon denied for list_action_labels'
);

select finish();

rollback;
