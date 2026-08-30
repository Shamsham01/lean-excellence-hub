begin;

select plan(25);

create temporary table workforce_import_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on workforce_import_test_ids to anon, authenticated, service_role, lean_hub_private_owner;

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

set local role lean_hub_private_owner;

select is(
  private.split_organisation_unit_path('Site > Production > Line 1'),
  ARRAY['Site', 'Production', 'Line 1']::text[],
  'path parser splits hierarchical segments'
);

select is(
  private.split_organisation_unit_path('  Site  >   Production >Line 1 '),
  ARRAY['Site', 'Production', 'Line 1']::text[],
  'path parser trims whitespace around segments'
);

select is(
  private.split_organisation_unit_path(''),
  ARRAY[]::text[],
  'empty path returns empty array'
);

select is(
  private.split_organisation_unit_path(' > > '),
  ARRAY[]::text[],
  'malformed empty segments are ignored'
);

set local role authenticated;

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

set local role lean_hub_private_owner;

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
  'unit resolver returns not_found for zero matches'
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
  'unit resolver returns ambiguous for multiple matches'
);

delete from public.organisation_units
where organisation_id = (select id from workforce_import_test_ids where key = 'org_a')
  and code = 'production-b';

insert into public.organisation_units (
  organisation_id,
  name,
  code,
  unit_type,
  status,
  parent_unit_id
)
values
  (
    (select id from workforce_import_test_ids where key = 'org_a'),
    'Line 1',
    'line-1',
    'line',
    'active',
    (
      select unit_row.id
      from public.organisation_units unit_row
      where unit_row.organisation_id = (select id from workforce_import_test_ids where key = 'org_a')
        and unit_row.code = 'production-a'
      limit 1
    )
  );

select is(
  (
    select resolution_status
    from private.resolve_organisation_unit_path(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Production > Line 1'
    )
  ),
  'resolved',
  'unit resolver returns resolved for a unique hierarchical path'
);

select ok(
  (
    select resolved_unit_id is not null
    from private.resolve_organisation_unit_path(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Production > Line 1'
    )
  ),
  'unit resolver returns a UUID for a unique match'
);

insert into public.job_functions (
  organisation_id,
  code,
  name,
  status,
  created_by_membership_id
)
select
  (select id from workforce_import_test_ids where key = 'org_a'),
  job_function_seed.code,
  job_function_seed.name,
  'active',
  membership_row.id
from (
  values
    ('operator-a', 'Operator'),
    ('operator-b', 'Operator')
) as job_function_seed(code, name)
cross join lateral (
  select membership.id
  from public.organisation_memberships membership
  where membership.organisation_id = (select id from workforce_import_test_ids where key = 'org_a')
    and membership.status = 'active'
  order by membership.created_at
  limit 1
) as membership_row;

select is(
  (
    select resolution_status
    from private.resolve_job_function_by_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Operator'
    )
  ),
  'ambiguous',
  'job function resolver returns ambiguous for multiple matches'
);

delete from public.job_functions
where organisation_id = (select id from workforce_import_test_ids where key = 'org_a')
  and code = 'operator-b';

select is(
  (
    select resolution_status
    from private.resolve_job_function_by_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Missing Function'
    )
  ),
  'not_found',
  'job function resolver returns not_found for zero matches'
);

select is(
  (
    select resolution_status
    from private.resolve_job_function_by_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Operator'
    )
  ),
  'resolved',
  'job function resolver returns resolved for a unique match'
);

select ok(
  (
    select resolved_job_function_id is not null
    from private.resolve_job_function_by_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Operator'
    )
  ),
  'job function resolver returns a UUID for a unique match'
);

insert into public.roles (
  organisation_id,
  canonical_name,
  display_name,
  description,
  status,
  is_owner_role,
  is_protected
)
values
  (
    (select id from workforce_import_test_ids where key = 'org_a'),
    'duplicate-role-a',
    'Duplicate Role',
    'Duplicate role A',
    'active',
    false,
    false
  ),
  (
    (select id from workforce_import_test_ids where key = 'org_a'),
    'duplicate-role-b',
    'Duplicate Role',
    'Duplicate role B',
    'active',
    false,
    false
  );

insert into public.role_versions (
  organisation_id,
  role_id,
  version_number,
  status,
  created_by_membership_id,
  published_by_membership_id,
  published_at
)
select
  role_row.organisation_id,
  role_row.id,
  1,
  'published',
  membership_row.id,
  membership_row.id,
  statement_timestamp()
from public.roles role_row
cross join lateral (
  select membership.id
  from public.organisation_memberships membership
  where membership.organisation_id = role_row.organisation_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1
) as membership_row
where role_row.organisation_id = (select id from workforce_import_test_ids where key = 'org_a')
  and role_row.canonical_name in ('duplicate-role-a', 'duplicate-role-b');

select is(
  (
    select resolution_status
    from private.resolve_role_version_by_display_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Duplicate Role'
    )
  ),
  'ambiguous',
  'role resolver returns ambiguous for multiple matches'
);

select is(
  (
    select resolution_status
    from private.resolve_role_version_by_display_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Missing Role'
    )
  ),
  'not_found',
  'role resolver returns not_found for zero matches'
);

select is(
  (
    select resolution_status
    from private.resolve_role_version_by_display_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Team Member'
    )
  ),
  'resolved',
  'role resolver returns resolved for a unique baseline role'
);

select ok(
  (
    select resolved_role_version_id is not null
    from private.resolve_role_version_by_display_name(
      (select id from workforce_import_test_ids where key = 'org_a'),
      'Team Member'
    )
  ),
  'role resolver returns a UUID for a unique match'
);

select is(
  (
    select count(*)::integer
    from public.workforce_import_row_credentials credential_row
    join public.workforce_import_rows import_row
      on import_row.id = credential_row.import_row_id
    where import_row.organisation_id = (
      select id from workforce_import_test_ids where key = 'org_a'
    )
  ),
  0,
  'credential vault starts empty for the isolated import test organisation'
);

set local role authenticated;

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

select ok(
  not public.switch_organisation((select id from workforce_import_test_ids where key = 'org_a')),
  'unauthorised user cannot switch into import organisation'
);

select finish();
rollback;
