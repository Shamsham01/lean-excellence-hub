begin;

select plan(24);

create temporary table workforce_import_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on workforce_import_test_ids to anon, authenticated, service_role;

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
    '12000000-0000-0000-0000-000000000001',
    'import-admin@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'import-manager@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into workforce_import_test_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '12000000-0000-0000-0000-000000000001',
      'import-org',
      'Import Org'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"22000000-0000-0000-0000-000000000001","email":"import-admin@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from workforce_import_test_ids where key = 'org_a')),
  'admin can switch into import test organisation'
);

select ok(
  public.member_has_permission('workforce.import'),
  'organisation owner has workforce.import'
);

insert into workforce_import_test_ids (key, id)
select
  'job_a',
  public.create_workforce_import_job('employees.csv');

select ok(
  (select id is not null from workforce_import_test_ids where key = 'job_a'),
  'owner can create import job'
);

select lives_ok(
  $$
    select public.submit_workforce_import_rows(
      (select id from workforce_import_test_ids where key = 'job_a'),
      jsonb_build_array(
        jsonb_build_object(
          'first_name', 'Anna',
          'last_name', 'Smith',
          'username', 'anna.smith',
          'notification_email', 'anna@example.test',
          'job_title', 'Operator',
          'job_function', 'Operator',
          'primary_unit_path', 'Import Org',
          'application_role', 'Team Member',
          'access_scope_unit_path', 'Import Org'
        )
      )
    );
  $$,
  'owner can submit import rows'
);

select is(
  (
    select (public.validate_workforce_import_job(
      (select id from workforce_import_test_ids where key = 'job_a')
    ) ->> 'can_provision')::boolean
  ),
  false,
  'validation fails when organisational paths do not resolve'
);

select is(
  (
    select count(*)::integer
    from public.workforce_import_rows import_row
    where import_row.import_job_id = (select id from workforce_import_test_ids where key = 'job_a')
      and import_row.status = 'error'
  ),
  1,
  'invalid row is marked as error without provisioning'
);

select is(
  (
    select count(*)::integer
    from public.workforce_provision_intents intent_row
    where intent_row.source_import_job_id = (select id from workforce_import_test_ids where key = 'job_a')
  ),
  0,
  'validation does not create provisioning intents'
);

select is(
  (
    select resolution_status
    from private.resolve_organisation_unit_path(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Production'
    )
  ),
  'not_found',
  'ambiguous or unknown paths are not silently accepted'
);

insert into public.organisation_units (
  organisation_id,
  name,
  code,
  unit_type,
  status
)
values
  (
    (select id from workforce_import_test_ids where key = 'org_a'),
    'Production',
    'production-a',
    'department',
    'active'
  ),
  (
    (select id from workforce_import_test_ids where key = 'org_a'),
    'Production',
    'production-b',
    'department',
    'active'
  );

select is(
  (
    select resolution_status
    from private.resolve_organisation_unit_path(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Production'
    )
  ),
  'ambiguous',
  'duplicate unit names at the same level are rejected as ambiguous'
);

select is(
  (
    select count(*)::integer
    from public.workforce_import_row_credentials credential_row
  ),
  0,
  'credential vault starts empty'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"22000000-0000-0000-0000-000000000002","email":"import-manager@example.test"}',
  true
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '22000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  )
on conflict do nothing;

set local role authenticated;

select throws_ok(
  $$
    select public.switch_organisation((select id from workforce_import_test_ids where key = 'org_a'));
  $$,
  '42501',
  null,
  'unauthorised user cannot switch into import organisation'
);

select finish();
rollback;
