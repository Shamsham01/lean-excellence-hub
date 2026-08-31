begin;

select plan(16);

create temporary table workforce_import_scope_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on workforce_import_scope_ids to anon, authenticated, service_role, lean_hub_private_owner;

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
    '13000000-0000-0000-0000-000000000001',
    'scope-import-owner@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    'scope-import-admin@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into workforce_import_scope_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '13000000-0000-0000-0000-000000000001',
      'scope-import-org',
      'Scope Import Org'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '13000000-0000-0000-0000-000000000001',
      'scope-import-other',
      'Other Import Org'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '23000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from workforce_import_scope_ids where key = 'org_a'),
    '13000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '13000000-0000-0000-0000-000000000002';

insert into workforce_import_scope_ids (key, id)
select
  'owner_membership',
  membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from workforce_import_scope_ids where key = 'org_a')
  and membership.user_id = '13000000-0000-0000-0000-000000000001';

insert into workforce_import_scope_ids (key, id)
select
  'admin_membership',
  membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from workforce_import_scope_ids where key = 'org_a')
  and membership.user_id = '13000000-0000-0000-0000-000000000002';

insert into workforce_import_scope_ids (key, id)
select
  'admin_role_version',
  role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from workforce_import_scope_ids where key = 'org_a')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"23000000-0000-0000-0000-000000000001","email":"scope-import-owner@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from workforce_import_scope_ids where key = 'org_a')),
  'owner selects scope import organisation'
);

insert into workforce_import_scope_ids (key, id)
select
  'production_unit',
  public.create_organisation_unit(
    (select id from workforce_import_scope_ids where key = 'org_a'),
    null,
    'scope-production',
    'Production',
    'department'
  );

insert into workforce_import_scope_ids (key, id)
select
  'line_unit',
  public.create_organisation_unit(
    (select id from workforce_import_scope_ids where key = 'org_a'),
    (select id from workforce_import_scope_ids where key = 'production_unit'),
    'scope-line-1',
    'Line 1',
    'line'
  );

select ok(
  public.switch_organisation((select id from workforce_import_scope_ids where key = 'org_b')),
  'owner selects other organisation for cross-org fixture'
);

insert into workforce_import_scope_ids (key, id)
select
  'other_org_unit',
  public.create_organisation_unit(
    (select id from workforce_import_scope_ids where key = 'org_b'),
    null,
    'other-secret-site',
    'Secret Site',
    'site'
  );

select ok(
  public.switch_organisation((select id from workforce_import_scope_ids where key = 'org_a')),
  'owner returns to scope import organisation'
);

set local role lean_hub_private_owner;

insert into public.job_functions (
  organisation_id,
  code,
  name,
  status,
  created_by_membership_id
)
select
  (select id from workforce_import_scope_ids where key = 'org_a'),
  'operator-scope',
  'Operator',
  'active',
  (select id from workforce_import_scope_ids where key = 'owner_membership');

set local role authenticated;

select ok(
  public.grant_role_version(
    (select id from workforce_import_scope_ids where key = 'org_a'),
    (select id from workforce_import_scope_ids where key = 'admin_membership'),
    (select id from workforce_import_scope_ids where key = 'admin_role_version'),
    'organisation',
    null
  ) is not null,
  'owner grants organisation administrator role for delegation tests'
);

set local role lean_hub_private_owner;

create or replace function pg_temp.import_scope_payload(
  target_username text,
  target_role text,
  target_scope_path text default 'Production > Line 1'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'first_name', 'Import',
    'last_name', 'Employee',
    'username', target_username,
    'notification_email', '',
    'job_title', 'Operator',
    'job_function', 'Operator',
    'primary_unit_path', 'Production > Line 1',
    'application_role', target_role,
    'access_scope_unit_path', target_scope_path
  );
$$;

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('team.member', 'Team Member')
    )
  ),
  'valid',
  'team member with unit path validates successfully'
);

select is(
  (
    select resolved ->> 'scope_type'
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('team.member.scope', 'Team Member')
    )
  ),
  'unit_subtree',
  'team member resolves to unit_subtree scope'
);

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('manager.member', 'Manager')
    )
  ),
  'valid',
  'manager with unit path validates when owner may delegate'
);

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('finance.validator', 'Finance Validator', '')
    )
  ),
  'valid',
  'finance validator with blank scope path validates'
);

select is(
  (
    select resolved ->> 'scope_type'
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('finance.validator.scope', 'Finance Validator', '')
    )
  ),
  'organisation',
  'finance validator resolves to organisation scope'
);

select is(
  (
    select resolved ->> 'scope_unit_id'
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('finance.validator.null', 'Finance Validator', '')
    )
  ),
  null,
  'organisation-scoped role stores null scope_unit_id'
);

select ok(
  (
    select field_errors::text like '%requires an access scope. Provide the full organisational path.%'
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('team.member.blank', 'Team Member', '')
    )
  ),
  'team member without scope path returns actionable validation error'
);

select ok(
  (
    select field_errors::text like '%is an organisation-wide role. Leave access_scope_unit_path blank.%'
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('finance.validator.bad', 'Finance Validator')
    )
  ),
  'finance validator with unit path returns actionable validation error'
);

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'admin_membership'),
      pg_temp.import_scope_payload('finance.validator.admin', 'Finance Validator', '')
    )
  ),
  'error',
  'organisation administrator cannot delegate finance validator'
);

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('finance.validator.owner', 'Finance Validator', '')
    )
  ),
  'valid',
  'owner can delegate finance validator when policy allows'
);

select is(
  (
    select row_status
    from private.validate_workforce_import_row_payload(
      (select id from workforce_import_scope_ids where key = 'org_a'),
      (select id from workforce_import_scope_ids where key = 'owner_membership'),
      pg_temp.import_scope_payload('cross.org.scope', 'Team Member', 'Secret Site')
    )
  ),
  'error',
  'cross-organisation scope path remains denied'
);

set local role authenticated;

select lives_ok(
  $$
    select public.preauthorize_workforce_provision(
      'M1 Regression',
      'm1.regression',
      (
        select role_version.id
        from public.role_versions role_version
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where role_version.organisation_id = (
          select id from workforce_import_scope_ids where key = 'org_a'
        )
          and role_row.canonical_name = 'organisation-administrator'
          and role_version.status = 'published'
        limit 1
      ),
      'organisation'
    );
  $$,
  'manual m1 provisioning remains unchanged'
);

select finish();
rollback;
