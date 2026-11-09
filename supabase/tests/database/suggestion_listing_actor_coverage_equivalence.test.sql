-- Compare set-based private.suggestion_listing_actor_coverage with reference probes.

begin;

select plan(21);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'f4000000-0000-0000-0000-000000000001',
  'cov-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f4000000-0000-0000-0000-000000000002',
  'cov-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f4000000-0000-0000-0000-000000000003',
  'cov-noaccess@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table cov_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on cov_ids to authenticated, lean_hub_private_owner;

insert into cov_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f4000000-0000-0000-0000-000000000001',
    'cov-org',
    'Coverage Equivalence Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'f4100000-0000-0000-0000-000000000001',
  'f4000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000001","email":"cov-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from cov_ids where key = 'organisation')),
  'owner selects coverage organisation'
);

insert into cov_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from cov_ids where key = 'organisation')
  and membership_row.user_id = 'f4000000-0000-0000-0000-000000000001';

set local role lean_hub_private_owner;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from cov_ids where key = 'organisation'),
      'f4000000-0000-0000-0000-000000000002',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into cov_ids (key, id)
select 'manager_membership', id from inserted_membership;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from cov_ids where key = 'organisation'),
      'f4000000-0000-0000-0000-000000000003',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into cov_ids (key, id)
select 'noaccess_membership', id from inserted_membership;

set local role authenticated;

set local role lean_hub_private_owner;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f4000000-0000-0000-0000-000000000002',
  'f4000000-0000-0000-0000-000000000003'
);

set local role authenticated;

insert into cov_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from cov_ids where key = 'organisation'),
  null,
  'cov-bodmin',
  'Bodmin',
  'site'
);

insert into cov_ids (key, id)
select 'bodmin_area', public.create_organisation_unit(
  (select id from cov_ids where key = 'organisation'),
  (select id from cov_ids where key = 'bodmin_site'),
  'cov-bodmin-area',
  'Bodmin Area',
  'area'
);

insert into cov_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from cov_ids where key = 'organisation'),
  null,
  'cov-exeter',
  'Exeter',
  'site'
);

insert into cov_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from cov_ids where key = 'organisation'),
  'coverage-manager',
  'Coverage manager',
  'Unit-scoped suggestions read and review'
);

select ok(
  public.add_role_permission(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_role'),
    'suggestions.read'
  ),
  'manager role receives suggestions.read'
);

select ok(
  public.add_role_permission(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_role'),
    'suggestions.review'
  ),
  'manager role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_role')
  ),
  'manager role publishes'
);

insert into cov_ids (key, id)
select 'manager_grant', public.grant_role_version(
  (select id from cov_ids where key = 'organisation'),
  (select id from cov_ids where key = 'manager_membership'),
  (select id from cov_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from cov_ids where key = 'bodmin_area')
);

insert into cov_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'owner_membership'),
    (select id from cov_ids where key = 'job_function'),
    true,
    (select id from cov_ids where key = 'bodmin_site')
  ) is not null,
  'owner primary placement at Bodmin'
);

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'manager_membership'),
    (select id from cov_ids where key = 'job_function'),
    true,
    (select id from cov_ids where key = 'bodmin_site')
  ) is not null,
  'manager primary site Bodmin'
);

insert into cov_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Coverage Ideas', 'coverage-ideas', 'coverage programme'
);

insert into cov_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from cov_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from cov_ids where key = 'programme_version')
  ),
  'coverage programme version publishes'
);

insert into cov_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into cov_ids (key, id)
select 'bodmin_suggestion', public.create_suggestion_draft(
  (select id from cov_ids where key = 'programme_version'),
  (select id from cov_ids where key = 'category'),
  'Bodmin suggestion',
  'Problem',
  'Idea',
  'Benefit'
);

select ok(
  public.submit_suggestion((select id from cov_ids where key = 'bodmin_suggestion')),
  'Bodmin suggestion submits'
);

create temporary table cov_actor_reference (
  actor_key text primary key,
  membership_id uuid not null
) on commit drop;

grant select, insert on cov_actor_reference to lean_hub_private_owner;

insert into cov_actor_reference (actor_key, membership_id)
values
  ('owner', (select id from cov_ids where key = 'owner_membership')),
  ('manager', (select id from cov_ids where key = 'manager_membership')),
  ('noaccess', (select id from cov_ids where key = 'noaccess_membership'));

set local role lean_hub_private_owner;

select is(
  (
    select has_org_read
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'owner')
    )
  ),
  private.membership_has_scoped_permission(
    (select membership_id from cov_actor_reference where actor_key = 'owner'),
    (select id from cov_ids where key = 'organisation'),
    'suggestions.read',
    null,
    null
  ),
  'owner org-read flag matches reference'
);

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  (
    select coalesce(array_agg(unit_id order by unit_id), '{}'::uuid[])
    from (
      select distinct unit_id
      from (
        select suggestion_row.origin_unit_id as unit_id
        from public.improvement_suggestions suggestion_row
        where suggestion_row.organisation_id = (select id from cov_ids where key = 'organisation')
          and suggestion_row.origin_unit_id is not null
        union
        select suggestion_row.review_jurisdiction_unit_id
        from public.improvement_suggestions suggestion_row
        where suggestion_row.organisation_id = (select id from cov_ids where key = 'organisation')
          and suggestion_row.review_jurisdiction_unit_id is not null
      ) units
    ) candidate_units
    where private.membership_has_scoped_permission(
      (select membership_id from cov_actor_reference where actor_key = 'manager'),
      (select id from cov_ids where key = 'organisation'),
      'suggestions.read',
      null,
      candidate_units.unit_id
    )
  ),
  'manager readable units match per-unit reference'
);

select is(
  (
    select has_org_read
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'noaccess')
    )
  ),
  false,
  'no-access actor has no org read'
);

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'noaccess')
    )
  ),
  '{}'::uuid[],
  'no-access actor has empty readable units'
);

select is(
  (
    select reviewable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  (
    select coalesce(array_agg(unit_id order by unit_id), '{}'::uuid[])
    from (
      select distinct unit_id
      from (
        select suggestion_row.origin_unit_id as unit_id
        from public.improvement_suggestions suggestion_row
        where suggestion_row.organisation_id = (select id from cov_ids where key = 'organisation')
          and suggestion_row.origin_unit_id is not null
        union
        select suggestion_row.review_jurisdiction_unit_id
        from public.improvement_suggestions suggestion_row
        where suggestion_row.organisation_id = (select id from cov_ids where key = 'organisation')
          and suggestion_row.review_jurisdiction_unit_id is not null
      ) units
    ) candidate_units
    where private.membership_has_scoped_permission(
      (select membership_id from cov_actor_reference where actor_key = 'manager'),
      (select id from cov_ids where key = 'organisation'),
      'suggestions.review',
      null,
      candidate_units.unit_id
    )
  ),
  'manager reviewable units match per-unit reference'
);

select is(
  (
    select manageable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  '{}'::uuid[],
  'manager without manage grant has empty manageable units'
);

select is(
  (
    select has_org_review
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  private.membership_has_scoped_permission(
    (select membership_id from cov_actor_reference where actor_key = 'manager'),
    (select id from cov_ids where key = 'organisation'),
    'suggestions.review',
    null,
    null
  ),
  'manager org-review flag matches reference'
);

select is(
  (
    select has_self_read
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  private.membership_has_scoped_permission(
    (select membership_id from cov_actor_reference where actor_key = 'manager'),
    (select id from cov_ids where key = 'organisation'),
    'suggestions.read',
    (select membership_id from cov_actor_reference where actor_key = 'manager'),
    null
  ),
  'manager self-read flag matches reference'
);

select ok(
  (
    select count(*) = 1
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'owner')
    )
  ),
  'coverage returns a single row for owner'
);

select ok(
  (
    select count(*) = 1
    from private.suggestion_listing_actor_coverage(null, null)
  ),
  'null context returns a single empty row'
);

select is(
  (
    select has_org_manage
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'owner')
    )
  ),
  private.membership_has_scoped_permission(
    (select membership_id from cov_actor_reference where actor_key = 'owner'),
    (select id from cov_ids where key = 'organisation'),
    'suggestions.manage',
    null,
    null
  ),
  'owner org-manage flag matches reference'
);

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'owner')
    )
  ),
  '{}'::uuid[],
  'owner org-wide read uses empty readable unit list'
);

select is(
  (
    select reviewable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'owner')
    )
  ),
  '{}'::uuid[],
  'owner org-wide review uses empty reviewable unit list'
);

select * from finish();
rollback;
