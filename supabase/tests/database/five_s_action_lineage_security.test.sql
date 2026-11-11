begin;

select plan(2);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'f5a00000-0000-0000-0000-000000000001',
  'five-s-lineage-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f5a00000-0000-0000-0000-000000000002',
  'five-s-lineage-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table five_s_lineage_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on five_s_lineage_ids to authenticated;

insert into five_s_lineage_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f5a00000-0000-0000-0000-000000000001',
    'five-s-lineage-org',
    'Five S Lineage Org'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'f5a00000-0000-0000-0000-000000000002',
    'five-s-lineage-outsider-org',
    'Five S Outsider Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f5a10000-0000-0000-0000-000000000001',
    'f5a00000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f5a10000-0000-0000-0000-000000000002',
    'f5a00000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"f5a00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f5a10000-0000-0000-0000-000000000001","email":"five-s-lineage-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from five_s_lineage_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into five_s_lineage_ids (key, id)
select 'foreign_action', public.create_action('Foreign org probe action');

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f5a00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f5a10000-0000-0000-0000-000000000002","email":"five-s-lineage-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from five_s_lineage_ids where key = 'other_organisation')),
  'outsider selects own organisation'
);

select throws_ok(
  format(
    'select public.get_five_s_action_lineage(%L::uuid)',
    (select id from five_s_lineage_ids where key = 'foreign_action')
  ),
  '42501',
  null,
  'outsider cannot read five_s lineage for foreign action'
);

select finish();
rollback;
