begin;

select plan(24);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd2460000-0000-4000-8000-000000000001',
    'site-capacity-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd2460000-0000-4000-8000-000000000002',
    'site-capacity-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd2460000-0000-4000-8000-000000000003',
    'site-capacity-legacy@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table site_capacity_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on site_capacity_ids to authenticated, anon;

insert into site_capacity_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'd2460000-0000-4000-8000-000000000001',
      'site-capacity-a',
      'Site Capacity A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'd2460000-0000-4000-8000-000000000002',
      'site-capacity-b',
      'Site Capacity B'
    )
  ),
  (
    'org_legacy',
    private.provision_organisation(
      'd2460000-0000-4000-8000-000000000003',
      'site-capacity-legacy',
      'Site Capacity Legacy'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'd2461000-0000-4000-8000-000000000001',
    'd2460000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd2461000-0000-4000-8000-000000000002',
    'd2460000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd2461000-0000-4000-8000-000000000003',
    'd2460000-0000-4000-8000-000000000003',
    statement_timestamp(), statement_timestamp()
  );

select lives_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    'fake',
    'cus_site_capacity_a'
  ),
  'org A billing account can be created'
);

select lives_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from site_capacity_ids where key = 'org_b'),
    'fake',
    'cus_site_capacity_b'
  ),
  'org B billing account can be created'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from site_capacity_ids where key = 'org_a'),
    'fake',
    'cus_site_capacity_a',
    'sub_site_capacity_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    statement_timestamp()
  ),
  'applied',
  'org A quantity 1 subscription applies'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from site_capacity_ids where key = 'org_b'),
    'fake',
    'cus_site_capacity_b',
    'sub_site_capacity_b',
    'professional',
    'monthly',
    2,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    statement_timestamp()
  ),
  'applied',
  'org B quantity 2 subscription applies'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'organisation_units'
      and trigger_row.tgname = 'organisation_units_enforce_site_capacity'
      and not trigger_row.tgisinternal
  ),
  'organisation_units has an authoritative site-capacity trigger'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.enforce_organisation_unit_site_capacity()'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'capacity trigger serialises activations with an organisation advisory lock'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace schema_row
      on schema_row.oid = procedure_row.pronamespace
    where schema_row.nspname = 'public'
      and procedure_row.proname = 'apply_organisation_subscription_snapshot'
      and pg_catalog.has_function_privilege(
        'authenticated',
        procedure_row.oid,
        'execute'
      )
  ),
  'ordinary authenticated callers cannot alter billing state'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace schema_row
      on schema_row.oid = procedure_row.pronamespace
    where schema_row.nspname = 'private'
      and procedure_row.proname = 'assert_organisation_can_add_site'
      and pg_catalog.has_function_privilege(
        'anon',
        procedure_row.oid,
        'execute'
      )
  ),
  'anon cannot execute the private site-capacity assertion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d2460000-0000-4000-8000-000000000001","role":"authenticated","session_id":"d2461000-0000-4000-8000-000000000001","email":"site-capacity-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_capacity_ids where key = 'org_a')),
  'owner selects organisation A'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    'capacity-site-1',
    'Capacity Site 1',
    'site'
  ),
  'quantity 1 with zero sites allows the first site'
);

insert into site_capacity_ids (key, id)
select
  'org_a_site_1',
  unit.id
from public.organisation_units unit
where unit.organisation_id = (select id from site_capacity_ids where key = 'org_a')
  and unit.code = 'capacity-site-1';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    (select id from site_capacity_ids where key = 'org_a_site_1'),
    'capacity-dept',
    'Capacity Department',
    'department'
  ),
  'non-site unit creation does not consume site capacity'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    'capacity-site-2',
    'Capacity Site 2',
    'site'
  ),
  'P0001',
  'site quantity is already at the paid subscription limit',
  'quantity 1 with one active site denies a second site over RPC'
);

select throws_ok(
  format(
    'select public.update_organisation_unit(%L::uuid, %L::uuid, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    (
      select unit.id
      from public.organisation_units unit
      where unit.organisation_id = (select id from site_capacity_ids where key = 'org_a')
        and unit.code = 'capacity-dept'
    ),
    'Capacity Department',
    'site'
  ),
  '23514',
  'site boundary classification cannot be changed through unit editing',
  'converting a unit to Site cannot bypass capacity'
);

select ok(
  public.set_organisation_unit_status(
    (select id from site_capacity_ids where key = 'org_a'),
    (select id from site_capacity_ids where key = 'org_a_site_1'),
    'retired',
    'Archive to free a site slot'
  ),
  'active site can be retired'
);

insert into site_capacity_ids (key, id)
select
  'org_a_site_2',
  public.create_organisation_unit(
    (select id from site_capacity_ids where key = 'org_a'),
    null,
    'capacity-site-2',
    'Capacity Site 2',
    'site'
  );

select throws_ok(
  format(
    'select public.set_organisation_unit_status(%L::uuid, %L::uuid, %L, %L)',
    (select id from site_capacity_ids where key = 'org_a'),
    (select id from site_capacity_ids where key = 'org_a_site_1'),
    'active',
    'Reactivated by administrator'
  ),
  'P0001',
  'site quantity is already at the paid subscription limit',
  'reactivating a retired site is denied when capacity is full'
);

select ok(
  public.set_organisation_unit_status(
    (select id from site_capacity_ids where key = 'org_a'),
    (select id from site_capacity_ids where key = 'org_a_site_2'),
    'retired',
    'Archive replacement site'
  ),
  'replacement site can be retired to free capacity'
);

select ok(
  public.set_organisation_unit_status(
    (select id from site_capacity_ids where key = 'org_a'),
    (select id from site_capacity_ids where key = 'org_a_site_1'),
    'active',
    'Reactivated by administrator'
  ),
  'reactivating a retired site succeeds when capacity exists'
);

select is(
  (
    select count(*)::integer
    from public.organisation_units unit
    where unit.organisation_id = (select id from site_capacity_ids where key = 'org_a')
      and unit.status = 'active'
      and unit.unit_type = 'site'
  ),
  1,
  'retired sites do not consume active capacity'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d2460000-0000-4000-8000-000000000002","role":"authenticated","session_id":"d2461000-0000-4000-8000-000000000002","email":"site-capacity-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_capacity_ids where key = 'org_b')),
  'owner selects organisation B'
);

insert into site_capacity_ids (key, id)
select
  'org_b_site_1',
  public.create_organisation_unit(
    (select id from site_capacity_ids where key = 'org_b'),
    null,
    'capacity-b-site-1',
    'Capacity B Site 1',
    'site'
  );

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_b'),
    'capacity-b-site-2',
    'Capacity B Site 2',
    'site'
  ),
  'quantity 2 with one active site allows a second site'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_b'),
    'capacity-b-site-3',
    'Capacity B Site 3',
    'site'
  ),
  'P0001',
  'site quantity is already at the paid subscription limit',
  'sibling tenant site count cannot consume another organisation slot'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d2460000-0000-4000-8000-000000000003","role":"authenticated","session_id":"d2461000-0000-4000-8000-000000000003","email":"site-capacity-legacy@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_capacity_ids where key = 'org_legacy')),
  'legacy owner selects organisation without a subscription'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_legacy'),
    'legacy-site-1',
    'Legacy Site 1',
    'site'
  ),
  'legacy organisations without a subscription can create the first site'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from site_capacity_ids where key = 'org_legacy'),
    'legacy-site-2',
    'Legacy Site 2',
    'site'
  ),
  'legacy / no-subscription organisations remain uncapped'
);

select * from finish();

rollback;
