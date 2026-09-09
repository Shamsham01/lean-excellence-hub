begin;

select plan(25);

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
  'b2000000-0000-0000-0000-000000000001',
  'orgv2-owner@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table orgv2_ids (
  key text primary key,
  id uuid not null
) on commit drop;
grant all on orgv2_ids to authenticated;

insert into orgv2_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2000000-0000-0000-0000-000000000001',
    'orgv2-org',
    'Organisation Structure V2 Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"orgv2-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from orgv2_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into orgv2_ids (key, id)
select
  'bodmin_site',
  public.create_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    null,
    'bodmin-site',
    'Bodmin Site',
    'site'
  );

insert into orgv2_ids (key, id)
select
  'bodmin_packing',
  public.create_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_site'),
    'bodmin-packing',
    'Bodmin Packing',
    'department'
  );

insert into orgv2_ids (key, id)
select
  'bodmin_production',
  public.create_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_site'),
    'bodmin-production',
    'Bodmin Production',
    'department'
  );

insert into orgv2_ids (key, id)
select
  'exeter_site',
  public.create_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    null,
    'exeter-site',
    'Exeter Site',
    'site'
  );

insert into orgv2_ids (key, id)
select
  'lifecycle_leaf',
  public.create_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_packing'),
    'lifecycle-leaf',
    'Lifecycle Leaf',
    'team'
  );

select is(
  (
    select id
    from public.organisation_units
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and code = 'lifecycle-leaf'
  ),
  (select id from orgv2_ids where key = 'lifecycle_leaf'),
  'create preserves stable UUID'
);

select ok(
  public.update_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'lifecycle_leaf'),
    'Lifecycle Leaf Renamed',
    'team'
  ),
  'rename/edit succeeds'
);

select is(
  (
    select name
    from public.organisation_units
    where id = (select id from orgv2_ids where key = 'lifecycle_leaf')
  ),
  'Lifecycle Leaf Renamed',
  'rename preserves UUID and updates name'
);

select ok(
  public.move_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'lifecycle_leaf'),
    (select id from orgv2_ids where key = 'bodmin_production')
  ),
  'same-site reparent succeeds'
);

select is(
  (
    select depth
    from public.organisation_unit_closure
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and ancestor_unit_id = (select id from orgv2_ids where key = 'bodmin_production')
      and descendant_unit_id = (select id from orgv2_ids where key = 'lifecycle_leaf')
  ),
  1::smallint,
  'closure table remains correct after reparent'
);

select throws_ok(
  format(
    'select public.move_organisation_unit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_site'),
    (select id from orgv2_ids where key = 'lifecycle_leaf')
  ),
  '23514',
  null,
  'cycle reparent rejected'
);

select throws_ok(
  format(
    'select public.move_organisation_unit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'lifecycle_leaf'),
    (select id from orgv2_ids where key = 'exeter_site')
  ),
  '23514',
  'cross-site unit reparent is not permitted',
  'cross-site reparent rejected'
);

select ok(
  public.set_organisation_unit_status(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'lifecycle_leaf'),
    'retired',
    'Lifecycle acceptance archive'
  ),
  'archive preserves UUID'
);

select is(
  (
    select status
    from public.organisation_units
    where id = (select id from orgv2_ids where key = 'lifecycle_leaf')
  ),
  'retired',
  'archived unit has retired status'
);

select is(
  (
    select count(*)
    from public.organisation_units
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and status = 'active'
      and code = 'lifecycle-leaf'
  ),
  0::bigint,
  'archived unit excluded from active hierarchy queries'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer_row,
         jsonb_array_elements(offer_row -> 'scope_options') scope_row
    where scope_row ->> 'scope_unit_id' = (select id::text from orgv2_ids where key = 'lifecycle_leaf')
  ),
  0::bigint,
  'archived unit excluded from new-scope offers'
);

select ok(
  public.set_organisation_unit_status(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'lifecycle_leaf'),
    'active',
    'Reactivated for acceptance'
  ),
  'reactivate succeeds safely'
);

select is(
  (
    select status
    from public.organisation_units
    where id = (select id from orgv2_ids where key = 'lifecycle_leaf')
  ),
  'active',
  'reactivated unit returns to active hierarchy'
);

select ok(
  not exists (
    select 1
    from pg_proc proc_row
    join pg_namespace namespace_row on namespace_row.oid = proc_row.pronamespace
    where namespace_row.nspname = 'public'
      and proc_row.proname like '%delete%organisation_unit%'
  ),
  'destructive delete RPC is not exposed for normal lifecycle'
);

insert into orgv2_ids (key, id)
select
  'grant_subject_membership',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from orgv2_ids where key = 'organisation')
  and membership_row.user_id = 'b2000000-0000-0000-0000-000000000001';

insert into orgv2_ids (key, id)
select
  'suggestions_role_version',
  role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from orgv2_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'suggestions'
  and role_version.status = 'published'
order by role_version.version_number desc
limit 1;

insert into orgv2_ids (key, id)
select
  'five_s_role_version',
  role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from orgv2_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'five_s'
  and role_version.status = 'published'
order by role_version.version_number desc
limit 1;

insert into orgv2_ids (key, id)
select
  'suggestions_grant',
  public.grant_role_version(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'grant_subject_membership'),
    (select id from orgv2_ids where key = 'suggestions_role_version'),
    'unit_subtree',
    (select id from orgv2_ids where key = 'bodmin_packing')
  );

insert into orgv2_ids (key, id)
select
  'five_s_grant',
  public.grant_role_version(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'grant_subject_membership'),
    (select id from orgv2_ids where key = 'five_s_role_version'),
    'unit_subtree',
    (select id from orgv2_ids where key = 'bodmin_production')
  );

select is(
  (
    select count(*)
    from public.access_grants
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and grantee_membership_id = (select id from orgv2_ids where key = 'grant_subject_membership')
      and status = 'active'
      and id in (
        select id from orgv2_ids where key in ('suggestions_grant', 'five_s_grant')
      )
  ),
  2::bigint,
  'multiple scoped grants coexist before archive checks'
);

select throws_ok(
  format(
    'select public.set_organisation_unit_status(%L::uuid, %L::uuid, %L, %L)',
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_packing'),
    'retired',
    'Blocked by active grant'
  ),
  '23514',
  'active scoped grants must be revoked before retirement',
  'archive rejects active scoped grant anchor'
);

select ok(
  public.revoke_access_grant(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'suggestions_grant'),
    'Revoke suggestions for acceptance'
  ),
  'revoking one grant succeeds'
);

select is(
  (
    select count(*)
    from public.access_grants
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and grantee_membership_id = (select id from orgv2_ids where key = 'grant_subject_membership')
      and status = 'active'
      and id in (
        select id from orgv2_ids where key in ('suggestions_grant', 'five_s_grant')
      )
  ),
  1::bigint,
  'revoking one grant does not remove the other'
);

select ok(
  exists (
    select 1
    from public.access_grants
    where id = (select id from orgv2_ids where key = 'five_s_grant')
      and status = 'active'
  ),
  'remaining scoped grant stays active'
);

select ok(
  private.resolve_site_unit_id(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_packing')
  )
  is distinct from private.resolve_site_unit_id(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'exeter_site')
  ),
  'site containment remains intact for membership site access'
);

select throws_ok(
  format(
    'select public.update_organisation_unit(%L::uuid, %L::uuid, %L, %L)',
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_site'),
    'Bodmin Site',
    'department'
  ),
  '23514',
  'site boundary classification cannot be changed through unit editing',
  'site to non-site type edit rejected'
);

select throws_ok(
  format(
    'select public.update_organisation_unit(%L::uuid, %L::uuid, %L, %L)',
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_packing'),
    'Bodmin Packing',
    'site'
  ),
  '23514',
  'site boundary classification cannot be changed through unit editing',
  'non-site to site type edit rejected'
);

select ok(
  public.update_organisation_unit(
    (select id from orgv2_ids where key = 'organisation'),
    (select id from orgv2_ids where key = 'bodmin_production'),
    'Bodmin Production',
    'division'
  ),
  'non-site to non-site type edit allowed'
);

select is(
  (
    select id
    from public.organisation_units
    where organisation_id = (select id from orgv2_ids where key = 'organisation')
      and code = 'bodmin-site'
  ),
  (select id from orgv2_ids where key = 'bodmin_site'),
  'rejected site type edit preserves UUID'
);

select * from finish();
rollback;
