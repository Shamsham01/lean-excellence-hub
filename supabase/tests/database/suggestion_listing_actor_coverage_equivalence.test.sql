-- Non-vacuous equivalence for set-based private.suggestion_listing_actor_coverage.

begin;

select plan(44);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

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
  'f4000000-0000-0000-0000-000000000004',
  'cov-exeter@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f4000000-0000-0000-0000-000000000005',
  'cov-baseline@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f4000000-0000-0000-0000-000000000006',
  'cov-nosite-owner@example.test',
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
),
(
  'f4100000-0000-0000-0000-000000000002',
  'f4000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'f4100000-0000-0000-0000-000000000004',
  'f4000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'f4100000-0000-0000-0000-000000000006',
  'f4000000-0000-0000-0000-000000000006',
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
    ),
    (
      (select id from cov_ids where key = 'organisation'),
      'f4000000-0000-0000-0000-000000000004',
      'active',
      statement_timestamp()
    ),
    (
      (select id from cov_ids where key = 'organisation'),
      'f4000000-0000-0000-0000-000000000005',
      'active',
      statement_timestamp()
    )
  returning id, user_id
)
insert into cov_ids (key, id)
select
  case inserted_membership.user_id
    when 'f4000000-0000-0000-0000-000000000002' then 'manager_membership'
    when 'f4000000-0000-0000-0000-000000000004' then 'exeter_membership'
    else 'baseline_membership'
  end,
  inserted_membership.id
from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f4000000-0000-0000-0000-000000000002',
  'f4000000-0000-0000-0000-000000000004',
  'f4000000-0000-0000-0000-000000000005'
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

select ok(
  private.organisation_requires_site_boundary(
    (select id from cov_ids where key = 'organisation')
  ),
  'multi-site organisation requires site boundary'
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
  'owner primary placement at Bodmin site'
);

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'manager_membership'),
    (select id from cov_ids where key = 'job_function'),
    true,
    (select id from cov_ids where key = 'bodmin_area')
  ) is not null,
  'manager primary placement at Bodmin area'
);

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'exeter_membership'),
    (select id from cov_ids where key = 'job_function'),
    true,
    (select id from cov_ids where key = 'exeter_site')
  ) is not null,
  'exeter author primary placement at Exeter site'
);

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'baseline_membership'),
    (select id from cov_ids where key = 'job_function'),
    true,
    (select id from cov_ids where key = 'bodmin_area')
  ) is not null,
  'baseline reader primary placement at Bodmin area'
);

insert into cov_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from cov_ids where key = 'organisation'),
  'coverage-manager',
  'Coverage manager',
  'Unit-scoped suggestions read, review, and manage'
);

select ok(
  public.add_role_permission(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_role'),
    'suggestions.submit'
  ),
  'manager role receives suggestions.submit'
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
  public.add_role_permission(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_role'),
    'suggestions.manage'
  ),
  'manager role receives suggestions.manage'
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
select 'exeter_role', public.create_role_draft(
  (select id from cov_ids where key = 'organisation'),
  'coverage-exeter-submit',
  'Exeter submitter',
  'Exeter site submit only'
);

select ok(
  public.add_role_permission(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'exeter_role'),
    'suggestions.submit'
  ),
  'exeter role receives suggestions.submit'
);

select ok(
  public.publish_role_version(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'exeter_role')
  ),
  'exeter submit role publishes'
);

insert into cov_ids (key, id)
select 'exeter_grant', public.grant_role_version(
  (select id from cov_ids where key = 'organisation'),
  (select id from cov_ids where key = 'exeter_membership'),
  (select id from cov_ids where key = 'exeter_role'),
  'unit_subtree',
  (select id from cov_ids where key = 'exeter_site')
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

-- Manager suggestion inside subtree (Bodmin Area).
select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000002","email":"cov-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from cov_ids where key = 'organisation')),
  'manager selects organisation'
);

insert into cov_ids (key, id)
select 'area_suggestion', public.create_suggestion_draft(
  (select id from cov_ids where key = 'programme_version'),
  (select id from cov_ids where key = 'category'),
  'Area suggestion',
  'Problem',
  'Idea',
  'Benefit'
);

select ok(
  public.submit_suggestion((select id from cov_ids where key = 'area_suggestion')),
  'area subtree suggestion submits'
);

-- Exeter suggestion (cross-site candidate).
select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000004","email":"cov-exeter@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from cov_ids where key = 'organisation')),
  'exeter author selects organisation'
);

insert into cov_ids (key, id)
select 'exeter_suggestion', public.create_suggestion_draft(
  (select id from cov_ids where key = 'programme_version'),
  (select id from cov_ids where key = 'category'),
  'Exeter suggestion',
  'Problem',
  'Idea',
  'Benefit'
);

select ok(
  public.submit_suggestion((select id from cov_ids where key = 'exeter_suggestion')),
  'exeter suggestion submits'
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
  ('baseline', (select id from cov_ids where key = 'baseline_membership'));

set local role lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Core manager coverage (literal + reference)
-- ---------------------------------------------------------------------------

select ok(
  (
    select (select id from cov_ids where key = 'bodmin_area') = any(
      coverage.readable_unit_ids
    )
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    ) coverage
  ),
  'bodmin area is explicitly readable for manager'
);

select ok(
  not (
    select (select id from cov_ids where key = 'exeter_site') = any(
      coverage.readable_unit_ids
    )
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    ) coverage
  ),
  'exeter site is excluded by site boundary for area-scoped manager'
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
    select manageable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  array[(select id from cov_ids where key = 'bodmin_area')]::uuid[],
  'manager manageable units are exactly Bodmin area'
);

select is(
  (
    select reviewable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  array[(select id from cov_ids where key = 'bodmin_area')]::uuid[],
  'manager reviewable units are exactly Bodmin area'
);

-- ---------------------------------------------------------------------------
-- Revoked grant
-- ---------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000001","email":"cov-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from cov_ids where key = 'organisation')),
  'owner re-selects organisation for grant revoke'
);

select ok(
  public.revoke_access_grant(
    (select id from cov_ids where key = 'organisation'),
    (select id from cov_ids where key = 'manager_grant'),
    'coverage equivalence revoke'
  ),
  'manager grant revokes'
);

set local role lean_hub_private_owner;

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  '{}'::uuid[],
  'revoked grant yields empty readable units'
);

-- ---------------------------------------------------------------------------
-- Expired grant (re-grant then expire)
-- ---------------------------------------------------------------------------

insert into cov_ids (key, id)
select 'manager_grant_2', public.grant_role_version(
  (select id from cov_ids where key = 'organisation'),
  (select id from cov_ids where key = 'manager_membership'),
  (select id from cov_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from cov_ids where key = 'bodmin_area')
);

update public.access_grants grant_row
set status = 'expired'
where grant_row.id = (select id from cov_ids where key = 'manager_grant_2');

select ok(true, 'manager grant marked expired');

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  '{}'::uuid[],
  'expired grant yields empty readable units'
);

-- ---------------------------------------------------------------------------
-- Active grant restored for inactive membership test
-- ---------------------------------------------------------------------------

insert into cov_ids (key, id)
select 'manager_grant_3', public.grant_role_version(
  (select id from cov_ids where key = 'organisation'),
  (select id from cov_ids where key = 'manager_membership'),
  (select id from cov_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from cov_ids where key = 'bodmin_area')
);

update public.organisation_memberships membership_row
set
  status = 'inactive',
  inactivated_at = statement_timestamp(),
  status_reason = 'coverage equivalence inactive'
where membership_row.id = (select id from cov_ids where key = 'manager_membership');

select is(
  (
    select has_org_read
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  false,
  'inactive membership yields no org read'
);

select is(
  (
    select readable_unit_ids
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'manager')
    )
  ),
  '{}'::uuid[],
  'inactive membership yields empty readable units'
);

update public.organisation_memberships membership_row
set
  status = 'active',
  activated_at = coalesce(membership_row.activated_at, statement_timestamp()),
  inactivated_at = null,
  status_reason = null
where membership_row.id = (select id from cov_ids where key = 'manager_membership');

-- ---------------------------------------------------------------------------
-- Baseline participation (transaction-local toggle)
-- ---------------------------------------------------------------------------

update private.baseline_participation_permissions
set include_in_scoped_permission = true
where permission_key = 'suggestions.read';

select ok(
  (
    select (select id from cov_ids where key = 'bodmin_area') = any(
      coverage.readable_unit_ids
    )
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'organisation'),
      (select membership_id from cov_actor_reference where actor_key = 'baseline')
    ) coverage
  ),
  'baseline reader can read Bodmin area via baseline participation'
);

-- ---------------------------------------------------------------------------
-- Organisation without site units
-- ---------------------------------------------------------------------------

update private.baseline_participation_permissions
set include_in_scoped_permission = false
where permission_key = 'suggestions.read';

insert into cov_ids (key, id)
values (
  'nosite_organisation',
  private.provision_organisation(
    'f4000000-0000-0000-0000-000000000006',
    'cov-nosite',
    'Coverage No Site Org'
  )
);

insert into cov_ids (key, id)
select 'nosite_owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from cov_ids where key = 'nosite_organisation')
  and membership_row.user_id = 'f4000000-0000-0000-0000-000000000006';

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000006","email":"cov-nosite-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from cov_ids where key = 'nosite_organisation')),
  'nosite owner selects organisation'
);

insert into cov_ids (key, id)
values (
  'nosite_department',
  public.create_organisation_unit(
    (select id from cov_ids where key = 'nosite_organisation'),
    null,
    'cov-department',
    'Operations',
    'department'
  )
);

select ok(
  not private.organisation_requires_site_boundary(
    (select id from cov_ids where key = 'nosite_organisation')
  ),
  'no-site organisation does not require site boundary'
);

insert into cov_ids (key, id)
select 'nosite_role', public.create_role_draft(
  (select id from cov_ids where key = 'nosite_organisation'),
  'nosite-reader',
  'No site reader',
  'Department subtree reader'
);

select ok(
  public.add_role_permission(
    (select id from cov_ids where key = 'nosite_organisation'),
    (select id from cov_ids where key = 'nosite_role'),
    'suggestions.read'
  ),
  'nosite role receives suggestions.read'
);

select ok(
  public.publish_role_version(
    (select id from cov_ids where key = 'nosite_organisation'),
    (select id from cov_ids where key = 'nosite_role')
  ),
  'nosite role publishes'
);

set local role lean_hub_private_owner;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from cov_ids where key = 'nosite_organisation'),
      'f4000000-0000-0000-0000-000000000002',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into cov_ids (key, id)
select 'nosite_manager_membership', id from inserted_membership;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"f4100000-0000-0000-0000-000000000006","email":"cov-nosite-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from cov_ids where key = 'nosite_organisation')),
  'nosite owner re-selects for grants'
);

insert into cov_ids (key, id)
select 'nosite_grant', public.grant_role_version(
  (select id from cov_ids where key = 'nosite_organisation'),
  (select id from cov_ids where key = 'nosite_manager_membership'),
  (select id from cov_ids where key = 'nosite_role'),
  'unit_subtree',
  (select id from cov_ids where key = 'nosite_department')
);

insert into cov_ids (key, id)
select 'nosite_programme', public.create_suggestion_programme_draft(
  'No Site Ideas', 'nosite-ideas', 'nosite programme'
);

insert into cov_ids (key, id)
select 'nosite_programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from cov_ids where key = 'nosite_programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from cov_ids where key = 'nosite_programme_version')
  ),
  'nosite programme version publishes'
);

insert into cov_ids (key, id)
select 'nosite_category', public.create_suggestion_category('General', 'general');

insert into cov_ids (key, id)
select 'nosite_job_function', public.create_job_function('Operator Nosite', 'operator-nosite');

select ok(
  public.assign_membership_job_function(
    (select id from cov_ids where key = 'nosite_owner_membership'),
    (select id from cov_ids where key = 'nosite_job_function'),
    true,
    (select id from cov_ids where key = 'nosite_department')
  ) is not null,
  'nosite owner placement on department'
);

insert into cov_ids (key, id)
select 'nosite_suggestion', public.create_suggestion_draft(
  (select id from cov_ids where key = 'nosite_programme_version'),
  (select id from cov_ids where key = 'nosite_category'),
  'No site suggestion',
  'Problem',
  'Idea',
  'Benefit'
);

select ok(
  public.submit_suggestion((select id from cov_ids where key = 'nosite_suggestion')),
  'nosite suggestion submits'
);

set local role lean_hub_private_owner;

select is(
  (
    select has_org_read
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'nosite_organisation'),
      (select id from cov_ids where key = 'nosite_manager_membership')
    )
  ),
  false,
  'no-site manager does not receive org-wide read via unit grant'
);

select ok(
  (
    select (select id from cov_ids where key = 'nosite_department') = any(
      coverage.readable_unit_ids
    )
    from private.suggestion_listing_actor_coverage(
      (select id from cov_ids where key = 'nosite_organisation'),
      (select id from cov_ids where key = 'nosite_manager_membership')
    ) coverage
  ),
  'no-site org subtree grant resolves without site boundary'
);

-- ---------------------------------------------------------------------------
-- Batch probe limits
-- ---------------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  $$
    select public.member_has_permissions(
      array(
        select 'perm.' || generate_series
        from generate_series(1, 65)
      )
    )
  $$,
  '22023',
  'permission key batch exceeds limit of 64'
);

select throws_ok(
  $$
    select public.member_has_grant_permissions(
      array(
        select 'perm.' || generate_series
        from generate_series(1, 65)
      )
    )
  $$,
  '22023',
  'permission key batch exceeds limit of 64'
);

set local role lean_hub_private_owner;

select ok(
  (
    select count(*) = 1
    from private.suggestion_listing_actor_coverage(null, null)
  ),
  'null context returns a single empty row'
);

select * from finish();
rollback;
