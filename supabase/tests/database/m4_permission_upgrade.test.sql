begin;

select plan(5);

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
  '42000000-0000-0000-0000-000000000001',
  'upgrade-before@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table upgrade_ids (
  key text primary key,
  id uuid not null,
  int_value bigint
) on commit drop;

insert into upgrade_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '42000000-0000-0000-0000-000000000001',
    'upgrade-before-org',
    'Upgrade Before Organisation'
  )
);

insert into upgrade_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and membership.user_id = '42000000-0000-0000-0000-000000000001';

insert into upgrade_ids (key, id)
select 'owner_role', role_row.id
from public.roles role_row
where role_row.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and role_row.is_owner_role;

insert into upgrade_ids (key, id)
select 'owner_version_v1', role_version.id
from public.role_versions role_version
where role_version.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and role_version.role_id = (select id from upgrade_ids where key = 'owner_role')
  and role_version.version_number = 1;

insert into upgrade_ids (key, id, int_value)
select
  'v1_permission_count',
  (select id from upgrade_ids where key = 'owner_version_v1'),
  count(*)
from public.role_permissions role_permission
where role_permission.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and role_permission.role_version_id = (
    select id from upgrade_ids where key = 'owner_version_v1'
  );

with inserted_version as (
  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    (select id from upgrade_ids where key = 'organisation'),
    (select id from upgrade_ids where key = 'owner_role'),
    2,
    'draft',
    (select id from upgrade_ids where key = 'owner_membership')
  )
  returning id
)
insert into upgrade_ids (key, id)
select 'owner_version_v2', id from inserted_version;

with m4_permission_keys as (
  select unnest(
    array[
      'actions.read',
      'actions.create',
      'actions.update',
      'actions.assign',
      'actions.complete',
      'actions.verify',
      'templates.read',
      'templates.manage',
      'submissions.read',
      'submissions.create',
      'attachments.read',
      'attachments.upload',
      'attachments.archive',
      'comments.read',
      'comments.create',
      'comments.edit'
    ]::text[]
  ) as permission_key
)
insert into public.role_permissions (
  organisation_id,
  role_version_id,
  permission_key
)
select
  (select id from upgrade_ids where key = 'organisation'),
  (select id from upgrade_ids where key = 'owner_version_v2'),
  role_permission.permission_key
from public.role_permissions role_permission
where role_permission.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and role_permission.role_version_id = (
    select id from upgrade_ids where key = 'owner_version_v1'
  )
  and role_permission.permission_key not in (
    select permission_key from m4_permission_keys
  );

update public.role_versions
set status = 'retired',
    retired_at = statement_timestamp(),
    retired_by_membership_id = (
      select id from upgrade_ids where key = 'owner_membership'
    )
where id = (select id from upgrade_ids where key = 'owner_version_v1');

update public.role_versions
set status = 'published',
    published_by_membership_id = (
      select id from upgrade_ids where key = 'owner_membership'
    ),
    published_at = statement_timestamp()
where id = (select id from upgrade_ids where key = 'owner_version_v2');

update public.access_grants grant_row
set status = 'revoked',
    revoked_at = statement_timestamp(),
    revoked_by_membership_id = (
      select id from upgrade_ids where key = 'owner_membership'
    ),
    revocation_reason = 'simulated owner role version migration'
where grant_row.organisation_id = (
    select id from upgrade_ids where key = 'organisation'
  )
  and grant_row.role_version_id = (
    select id from upgrade_ids where key = 'owner_version_v1'
  )
  and grant_row.status = 'active';

insert into public.access_grants (
  organisation_id,
  grantee_membership_id,
  role_version_id,
  scope_type,
  grantor_membership_id
)
values (
  (select id from upgrade_ids where key = 'organisation'),
  (select id from upgrade_ids where key = 'owner_membership'),
  (select id from upgrade_ids where key = 'owner_version_v2'),
  'organisation',
  (select id from upgrade_ids where key = 'owner_membership')
);

select ok(
  not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = (
        select id from upgrade_ids where key = 'organisation'
      )
      and role_permission.role_version_id = (
        select id from upgrade_ids where key = 'owner_version_v2'
      )
      and role_permission.permission_key = 'comments.edit'
  ),
  'simulated pre-milestone-4 owner version omits comments.edit'
);

select private.system_upgrade_owner_role_permissions(
  array['comments.edit']::text[]
);

select ok(
  exists (
    select 1
    from public.role_versions role_version
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
    where role_version.organisation_id = (
        select id from upgrade_ids where key = 'organisation'
      )
      and role_version.role_id = (select id from upgrade_ids where key = 'owner_role')
      and role_version.status = 'published'
      and role_version.version_number = 3
      and role_permission.permission_key = 'comments.edit'
  ),
  'upgrade publishes successor owner version with missing permission'
);

select is(
  (
    select count(*)
    from public.role_permissions role_permission
    where role_permission.organisation_id = (
        select id from upgrade_ids where key = 'organisation'
      )
      and role_permission.role_version_id = (
        select id from upgrade_ids where key = 'owner_version_v1'
      )
  ),
  (select int_value from upgrade_ids where key = 'v1_permission_count'),
  'historical owner version permissions remain unchanged after upgrade'
);

select ok(
  exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    where grant_row.organisation_id = (
        select id from upgrade_ids where key = 'organisation'
      )
      and grant_row.status = 'active'
      and role_version.version_number = 3
      and role_version.status = 'published'
  ),
  'active owner grants rebind to successor role version'
);

select ok(
  (
    select count(*) = 2
    from pg_policies policy_row
    where policy_row.schemaname = 'storage'
      and policy_row.tablename = 'objects'
      and policy_row.policyname in (
        'organisation_evidence_read',
        'organisation_evidence_insert'
      )
  ),
  'storage policies exist for organisation evidence bucket'
);

select * from finish();
rollback;
