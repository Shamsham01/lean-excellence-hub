begin;

select plan(20);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '95000000-0000-0000-0000-000000000001',
    'primary-replace-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    'primary-replace-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '96000000-0000-0000-0000-000000000001',
    'primary-replace-other-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table primary_replace_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on primary_replace_ids to authenticated;

insert into primary_replace_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '95000000-0000-0000-0000-000000000001',
    'primary-replace-org',
    'Primary Replace Org'
  )
);

insert into primary_replace_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    '96000000-0000-0000-0000-000000000001',
    'primary-replace-other-org',
    'Primary Replace Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '97000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    '96000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000001","email":"primary-replace-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from primary_replace_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into primary_replace_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from primary_replace_ids where key = 'organisation'),
  null,
  'exeter-cookie-factory',
  'Exeter Cookie Factory',
  'site'
);

insert into primary_replace_ids (key, id)
select 'operations', public.create_organisation_unit(
  (select id from primary_replace_ids where key = 'organisation'),
  (select id from primary_replace_ids where key = 'site'),
  'operations',
  'Operations',
  'department'
);

insert into primary_replace_ids (key, id)
select 'quality', public.create_organisation_unit(
  (select id from primary_replace_ids where key = 'organisation'),
  (select id from primary_replace_ids where key = 'site'),
  'quality',
  'Quality',
  'department'
);

insert into primary_replace_ids (key, id)
select 'production_manager_job', public.create_job_function(
  'Production Manager',
  'production-manager'
);

insert into primary_replace_ids (key, id)
select 'access_role_draft', public.create_protected_role_draft(
  (select id from primary_replace_ids where key = 'organisation'),
  'exeter-production-manager',
  'Exeter Production Manager',
  'Operations subtree access'
);

select ok(
  public.add_role_permission(
    (select id from primary_replace_ids where key = 'organisation'),
    (select id from primary_replace_ids where key = 'access_role_draft'),
    'hierarchy.read'
  ),
  'access role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from primary_replace_ids where key = 'organisation'),
    (select id from primary_replace_ids where key = 'access_role_draft')
  ),
  'access role publishes'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from primary_replace_ids where key = 'organisation'),
    '95000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into primary_replace_ids (key, id)
select 'member_membership', id from inserted_membership;

set local role authenticated;

select ok(
  public.switch_organisation((select id from primary_replace_ids where key = 'organisation')),
  'owner reselects organisation for member setup'
);

insert into primary_replace_ids (key, id)
select 'access_grant', public.grant_role_version(
  (select id from primary_replace_ids where key = 'organisation'),
  (select id from primary_replace_ids where key = 'member_membership'),
  (select id from primary_replace_ids where key = 'access_role_draft'),
  'unit_subtree',
  (select id from primary_replace_ids where key = 'operations')
);

insert into primary_replace_ids (key, id)
select 'initial_assignment', public.assign_membership_job_function(
  (select id from primary_replace_ids where key = 'member_membership'),
  (select id from primary_replace_ids where key = 'production_manager_job'),
  true,
  (select id from primary_replace_ids where key = 'operations'),
  statement_timestamp(),
  null,
  'Initial Exeter Operations placement'
);

select is(
  (
    select count(*)::integer
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
      and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
      and assignment_row.is_primary = true
      and assignment_row.valid_to is null
  ),
  1,
  'member starts with exactly one active primary assignment at operations'
);

select ok(
  public.assign_membership_job_function(
    (select id from primary_replace_ids where key = 'member_membership'),
    (select id from primary_replace_ids where key = 'production_manager_job'),
    true,
    (select id from primary_replace_ids where key = 'quality'),
    statement_timestamp(),
    null,
    'Reassigned to Exeter Quality'
  ) is not null,
  'replace primary organisational unit with quality succeeds'
);

insert into primary_replace_ids (key, id)
select 'quality_assignment', assignment_row.id
from public.membership_job_function_assignments assignment_row
where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
  and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
  and assignment_row.is_primary = true
  and assignment_row.valid_to is null;

select ok(
  (
    select assignment_row.valid_to is not null
    from public.membership_job_function_assignments assignment_row
    where assignment_row.id = (select id from primary_replace_ids where key = 'initial_assignment')
  ),
  'previous operations assignment remains historically present with valid_to set'
);

select ok(
  (
    select assignment_row.valid_to is null
    from public.membership_job_function_assignments assignment_row
    where assignment_row.id = (select id from primary_replace_ids where key = 'quality_assignment')
  ),
  'new quality assignment is active with valid_to null'
);

select is(
  (
    select count(*)::integer
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
      and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
      and assignment_row.is_primary = true
      and assignment_row.valid_to is null
  ),
  1,
  'exactly one active primary assignment exists after replacement'
);

select ok(
  public.assign_membership_job_function(
    (select id from primary_replace_ids where key = 'member_membership'),
    (select id from primary_replace_ids where key = 'production_manager_job'),
    true,
    (select id from primary_replace_ids where key = 'operations'),
    statement_timestamp(),
    null,
    'Reassigned back to Exeter Operations'
  ) is not null,
  'replacement back to operations succeeds'
);

select is(
  public.assign_membership_job_function(
    (select id from primary_replace_ids where key = 'member_membership'),
    (select id from primary_replace_ids where key = 'production_manager_job'),
    true,
    (select id from primary_replace_ids where key = 'operations'),
    statement_timestamp(),
    null,
    'Idempotent repeat of current placement'
  ),
  (
    select assignment_row.id
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
      and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
      and assignment_row.is_primary = true
      and assignment_row.valid_to is null
  ),
  'repeating the same current placement returns the active assignment without duplicating history'
);

select is(
  (
    select count(*)::integer
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
      and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
      and assignment_row.is_primary = true
  ),
  3,
  'primary assignment history contains initial, quality, and operations rows only'
);

select ok(
  exists (
    select 1
    from public.access_grants grant_row
    where grant_row.id = (select id from primary_replace_ids where key = 'access_grant')
      and grant_row.revoked_at is null
      and grant_row.scope_type = 'unit_subtree'
      and grant_row.scope_unit_id = (select id from primary_replace_ids where key = 'operations')
  ),
  'operations subtree access grant remains unchanged throughout replacements'
);

create or replace function pg_temp.simulate_primary_assignment_insert_failure()
returns trigger
language plpgsql
as $$
begin
  if current_setting('test.simulate_primary_assignment_insert_failure', true) = 'on' then
    raise exception 'simulated primary assignment insert failure'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

reset role;
set local role postgres;

create trigger simulate_primary_assignment_insert_failure
before insert on public.membership_job_function_assignments
for each row
when (NEW.is_primary = true)
execute function pg_temp.simulate_primary_assignment_insert_failure();

set local role authenticated;

select ok(
  public.switch_organisation((select id from primary_replace_ids where key = 'organisation')),
  'owner reselects organisation before rollback simulation'
);

select set_config('test.simulate_primary_assignment_insert_failure', 'on', true);

select throws_ok(
  $$
    select public.assign_membership_job_function(
      (select id from primary_replace_ids where key = 'member_membership'),
      (select id from primary_replace_ids where key = 'production_manager_job'),
      true,
      (select id from primary_replace_ids where key = 'quality'),
      statement_timestamp(),
      null,
      'Simulated failed replacement'
    )
  $$,
  'P0001',
  'simulated primary assignment insert failure',
  'failed replacement rolls back atomically'
);

select set_config('test.simulate_primary_assignment_insert_failure', 'off', true);

select ok(
  (
    select assignment_row.organisational_unit_id = (
      select id from primary_replace_ids where key = 'operations'
    )
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from primary_replace_ids where key = 'organisation')
      and assignment_row.membership_id = (select id from primary_replace_ids where key = 'member_membership')
      and assignment_row.is_primary = true
      and assignment_row.valid_to is null
  ),
  'previous active primary assignment remains intact after failed replacement'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000002","email":"primary-replace-other-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from primary_replace_ids where key = 'other_organisation')),
  'other tenant owner selects organisation'
);

insert into primary_replace_ids (key, id)
select 'other_job_function', public.create_job_function(
  'Other Tenant Role',
  'other-tenant-role'
);

select throws_ok(
  $$
    select public.assign_membership_job_function(
      (select id from primary_replace_ids where key = 'member_membership'),
      (select id from primary_replace_ids where key = 'production_manager_job'),
      true,
      (select id from primary_replace_ids where key = 'quality')
    )
  $$,
  '22023',
  null,
  'foreign membership id is rejected for other tenant actor'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000001","email":"primary-replace-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from primary_replace_ids where key = 'organisation')),
  'original owner reselects organisation for invalid input checks'
);

select throws_ok(
  $$
    select public.assign_membership_job_function(
      (select id from primary_replace_ids where key = 'member_membership'),
      (select id from primary_replace_ids where key = 'other_job_function'),
      true,
      (select id from primary_replace_ids where key = 'quality')
    )
  $$,
  'P0002',
  null,
  'foreign job function id is rejected'
);

select * from finish();
rollback;
