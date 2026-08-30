begin;

select plan(34);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'catalog-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'catalog-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'catalog-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table catalog_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on catalog_ids to authenticated;

insert into catalog_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd1000000-0000-0000-0000-000000000001',
    'catalog-org',
    'Catalog Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('d2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  ((select id from catalog_ids where key = 'organisation'), 'd1000000-0000-0000-0000-000000000002', 'active', statement_timestamp());

update private.identity_controls
set status = 'active', enrolment_status = 'complete', enrolment_completed_at = statement_timestamp()
where user_id = 'd1000000-0000-0000-0000-000000000002';

insert into catalog_ids (key, id)
select 'member_membership', id
from public.organisation_memberships
where organisation_id = (select id from catalog_ids where key = 'organisation')
  and user_id = 'd1000000-0000-0000-0000-000000000002';

insert into catalog_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from catalog_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"catalog-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into catalog_ids (key, id)
select 'production_unit', public.create_organisation_unit(
  (select id from catalog_ids where key = 'organisation'),
  null,
  'production',
  'Production',
  'site'
);

insert into catalog_ids (key, id)
select 'line3_unit', public.create_organisation_unit(
  (select id from catalog_ids where key = 'organisation'),
  (select id from catalog_ids where key = 'production_unit'),
  'line-3',
  'Line 3',
  'line'
);

insert into catalog_ids (key, id)
select 'warehouse_unit', public.create_organisation_unit(
  (select id from catalog_ids where key = 'organisation'),
  null,
  'warehouse',
  'Warehouse',
  'site'
);

insert into catalog_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.grant_role_version(
    (select id from catalog_ids where key = 'organisation'),
    (select id from catalog_ids where key = 'member_membership'),
    (select id from catalog_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from catalog_ids where key = 'production_unit')
  ) is not null,
  'owner grants team member role at production subtree'
);

select ok(
  public.assign_membership_job_function(
    (select id from catalog_ids where key = 'member_membership'),
    (select id from catalog_ids where key = 'job_function'),
    true,
    (select id from catalog_ids where key = 'line3_unit')
  ) is not null,
  'team member primary assignment on line 3'
);

insert into catalog_ids (key, id)
select 'org_programme', public.create_suggestion_programme_draft(
  'Continuous Improvement Ideas',
  'ci',
  'Organisation-wide programme'
);

insert into catalog_ids (key, id)
select 'org_programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from catalog_ids where key = 'org_programme')
  and version_row.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from catalog_ids where key = 'org_programme_version')),
  'organisation programme publishes'
);

insert into catalog_ids (key, id)
select 'production_programme', public.create_suggestion_programme_draft(
  'Production Ideas',
  'production-ideas',
  'Production-only programme'
);

insert into catalog_ids (key, id)
select 'production_programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from catalog_ids where key = 'production_programme')
  and version_row.version_number = 1;

update public.suggestion_programme_versions version_row
set applicable_unit_id = (select id from catalog_ids where key = 'production_unit')
where version_row.id = (select id from catalog_ids where key = 'production_programme_version');

select ok(
  public.publish_suggestion_programme_version((select id from catalog_ids where key = 'production_programme_version')),
  'production programme publishes'
);

insert into catalog_ids (key, id)
select 'warehouse_programme', public.create_suggestion_programme_draft(
  'Warehouse Ideas',
  'warehouse-ideas',
  'Warehouse-only programme'
);

insert into catalog_ids (key, id)
select 'warehouse_programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from catalog_ids where key = 'warehouse_programme')
  and version_row.version_number = 1;

update public.suggestion_programme_versions version_row
set applicable_unit_id = (select id from catalog_ids where key = 'warehouse_unit')
where version_row.id = (select id from catalog_ids where key = 'warehouse_programme_version');

select ok(
  public.publish_suggestion_programme_version((select id from catalog_ids where key = 'warehouse_programme_version')),
  'warehouse programme publishes'
);

insert into catalog_ids (key, id)
select 'draft_programme', public.create_suggestion_programme_draft(
  'Draft Only',
  'draft-only',
  'Never published'
);

insert into catalog_ids (key, id)
select 'archived_programme', public.create_suggestion_programme_draft(
  'Archived History',
  'archived-history',
  'Will be superseded'
);

insert into catalog_ids (key, id)
select 'archived_programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from catalog_ids where key = 'archived_programme')
  and version_row.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from catalog_ids where key = 'archived_programme_version')),
  'archived programme initial version publishes'
);

select ok(
  public.create_suggestion_programme_successor_version((select id from catalog_ids where key = 'archived_programme')) is not null,
  'successor draft created for archived programme'
);

insert into catalog_ids (key, id)
select 'archived_successor_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from catalog_ids where key = 'archived_programme')
  and version_row.lifecycle = 'draft';

select ok(
  public.publish_suggestion_programme_version((select id from catalog_ids where key = 'archived_successor_version')),
  'successor publish archives prior published version'
);

insert into catalog_ids (key, id)
select 'active_category', public.create_suggestion_category('Quality', 'quality', null, 1);

insert into catalog_ids (key, id)
select 'deactivated_category', public.create_suggestion_category('Legacy', 'legacy', null, 2);

select ok(
  public.deactivate_suggestion_category((select id from catalog_ids where key = 'deactivated_category')),
  'owner deactivates legacy category'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000002","email":"catalog-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'team member selects organisation'
);

select ok(
  jsonb_array_length(
    public.get_available_suggestion_submission_configuration() -> 'programmes'
  ) >= 2,
  'team member with unit_subtree grant sees organisation-wide and in-scope programmes'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    where programme ->> 'programme_version_id' =
      (select id from catalog_ids where key = 'org_programme_version')::text
  ),
  'team member sees organisation-wide published programme'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    where programme ->> 'programme_version_id' =
      (select id from catalog_ids where key = 'production_programme_version')::text
  ),
  'team member sees production-scoped programme'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    where programme ->> 'programme_version_id' =
      (select id from catalog_ids where key = 'warehouse_programme_version')::text
  ),
  'team member does not see warehouse-scoped programme outside production subtree'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    join public.suggestion_programme_versions version_row
      on version_row.id = (programme ->> 'programme_version_id')::uuid
    where version_row.lifecycle <> 'published'
  ),
  'draft and archived programme versions are excluded from submission configuration'
);

select ok(
  jsonb_array_length(
    public.get_available_suggestion_submission_configuration() -> 'categories'
  ) = 1,
  'team member sees only active categories'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'categories'
    ) category
    where category ->> 'category_id' =
      (select id from catalog_ids where key = 'active_category')::text
  ),
  'team member sees active category'
);

select ok(
  public.create_suggestion_draft(
    (select id from catalog_ids where key = 'org_programme_version'),
    (select id from catalog_ids where key = 'active_category'),
    'Line routing improvement',
    'Loose cable routing on Line 3',
    'Route cables through dedicated trunking'
  ) is not null,
  'team member can create suggestion draft against published configuration'
);

select ok(
  not private.can_manage_suggestion_programmes((select id from catalog_ids where key = 'organisation')),
  'team member cannot manage suggestion programmes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"catalog-owner@example.test"}',
  true
);

select ok(
  public.update_suggestion_category(
    (select id from catalog_ids where key = 'active_category'),
    'Quality and Safety',
    'Quality-related ideas',
    5
  ),
  'admin can edit category'
);

select ok(
  public.deactivate_suggestion_category((select id from catalog_ids where key = 'active_category')),
  'admin can deactivate category'
);

select ok(
  public.reactivate_suggestion_category((select id from catalog_ids where key = 'active_category')),
  'admin can reactivate category'
);

insert into catalog_ids (key, id)
select 'referenced_category', public.create_suggestion_category('Safety', 'safety', null, 3);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000002","email":"catalog-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'team member selects organisation before referenced suggestion fixture'
);

insert into catalog_ids (key, id)
select 'referenced_suggestion', public.create_suggestion_draft(
  (select id from catalog_ids where key = 'org_programme_version'),
  (select id from catalog_ids where key = 'referenced_category'),
  'Safety guard',
  'Guard is loose',
  'Tighten guard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"catalog-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'owner re-selects organisation after referenced suggestion fixture'
);

select throws_ok(
  $$ select public.delete_suggestion_category((select id from catalog_ids where key = 'referenced_category')) $$,
  '55000',
  'category is referenced by suggestions; deactivate instead',
  'referenced category cannot be destructively deleted'
);

select ok(
  public.deactivate_suggestion_programme((select id from catalog_ids where key = 'org_programme')),
  'admin can deactivate programme'
);

select is(
  (
    select count(*)
    from public.suggestion_programme_versions version_row
    where version_row.programme_id = (select id from catalog_ids where key = 'archived_programme')
      and version_row.lifecycle = 'archived'
  )::integer,
  1,
  'published historical programme version remains archived after successor creation'
);

set local role postgres;

insert into catalog_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'd1000000-0000-0000-0000-000000000003',
    'catalog-org-b',
    'Catalog Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000002","email":"catalog-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'team member re-selects primary organisation for isolation check'
);

select ok(
  jsonb_array_length(
    public.get_available_suggestion_submission_configuration() -> 'programmes'
  ) >= 1,
  'team member still sees own organisation configuration after other org provisioned'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    join public.suggestion_programme_versions version_row
      on version_row.id = (programme ->> 'programme_version_id')::uuid
    where version_row.organisation_id = (select id from catalog_ids where key = 'organisation_b')
  ),
  'cross-organisation configuration is invisible to team member'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000002","email":"catalog-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from catalog_ids where key = 'organisation')),
  'team member selects organisation for deactivated programme visibility check'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_available_suggestion_submission_configuration() -> 'programmes'
    ) programme
    where programme ->> 'programme_version_id' =
      (select id from catalog_ids where key = 'org_programme_version')::text
  ),
  'deactivated programme is unavailable for new submission configuration'
);

select throws_ok(
  $$ select public.create_suggestion_draft(
    (select id from catalog_ids where key = 'org_programme_version'),
    (select id from catalog_ids where key = 'active_category'),
    'Another idea',
    'Problem',
    'Proposal'
  ) $$,
  '22023',
  'programme is not active for submission',
  'deactivated programme blocks new draft creation even when version remains published'
);

select * from finish();
rollback;
