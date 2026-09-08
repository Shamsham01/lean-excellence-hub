begin;

select plan(100);

-- CookieWorks Manufacturing — two-site hostile fixture (local/CI only).

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('b1000000-0000-0000-0000-000000000001', 'cw-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000002', 'bodmin-operator@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000003', 'exeter-operator@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000004', 'bodmin-maturity@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000005', 'exeter-5s@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000006', 'group-ci@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000007', 'multi-resp@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b1000000-0000-0000-0000-000000000008', 'bodmin-people@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table site_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on site_ids to authenticated;

insert into site_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000001',
    'cookieworks-mfg',
    'CookieWorks Manufacturing'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000007', statement_timestamp(), statement_timestamp()),
  ('c1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000008', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select
  (select id from site_ids where key = 'organisation'),
  members.user_id::uuid,
  'active',
  statement_timestamp()
from (values
  ('b1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000004'),
  ('b1000000-0000-0000-0000-000000000005'),
  ('b1000000-0000-0000-0000-000000000006'),
  ('b1000000-0000-0000-0000-000000000007'),
  ('b1000000-0000-0000-0000-000000000008')
) as members(user_id);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000004',
  'b1000000-0000-0000-0000-000000000005',
  'b1000000-0000-0000-0000-000000000006',
  'b1000000-0000-0000-0000-000000000007',
  'b1000000-0000-0000-0000-000000000008'
);

insert into site_ids (key, id)
select key, membership.id
from (
  values
    ('bodmin_operator_membership', 'b1000000-0000-0000-0000-000000000002'),
    ('exeter_operator_membership', 'b1000000-0000-0000-0000-000000000003'),
    ('bodmin_maturity_membership', 'b1000000-0000-0000-0000-000000000004'),
    ('exeter_5s_membership', 'b1000000-0000-0000-0000-000000000005'),
    ('group_ci_membership', 'b1000000-0000-0000-0000-000000000006'),
    ('multi_resp_membership', 'b1000000-0000-0000-0000-000000000007'),
    ('bodmin_people_membership', 'b1000000-0000-0000-0000-000000000008')
) as mapping(key, user_id)
join public.organisation_memberships membership
  on membership.organisation_id = (select id from site_ids where key = 'organisation')
 and membership.user_id = mapping.user_id::uuid;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'owner selects CookieWorks organisation'
);

-- Bodmin Cookie Factory + Packing
insert into site_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'), null,
  'bodmin-factory', 'Bodmin Cookie Factory', 'site'
);

insert into site_ids (key, id)
select 'bodmin_packing', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'bodmin_site'),
  'bodmin-packing', 'Packing', 'department'
);

insert into site_ids (key, id)
select 'bodmin_production', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'bodmin_site'),
  'bodmin-production', 'Production', 'department'
);

-- Exeter Cookie Factory + Packing
insert into site_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'), null,
  'exeter-factory', 'Exeter Cookie Factory', 'site'
);

insert into site_ids (key, id)
select 'exeter_packing', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'exeter_site'),
  'exeter-packing', 'Packing', 'department'
);

select ok(
  private.organisation_requires_site_boundary((select id from site_ids where key = 'organisation')),
  'CookieWorks requires site boundary'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing')
  ),
  (select id from site_ids where key = 'bodmin_site'),
  'descendant resolves to Bodmin site'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'exeter_packing')
  ),
  (select id from site_ids where key = 'exeter_site'),
  'descendant resolves to Exeter site'
);

select ok(
  private.units_share_site_boundary(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing'),
    (select id from site_ids where key = 'bodmin_production')
  ),
  'units within Bodmin share site boundary'
);

select ok(
  not private.units_share_site_boundary(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing'),
    (select id from site_ids where key = 'exeter_packing')
  ),
  'Bodmin and Exeter do not share site boundary'
);

insert into site_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into site_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_ids where key = 'organisation')
  and membership.user_id = 'b1000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from site_ids where key = 'owner_membership'),
    (select id from site_ids where key = 'job_function'),
    true,
    (select id from site_ids where key = 'bodmin_packing')
  ) is not null,
  'owner primary placement for module seeding'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_ids where key = 'bodmin_operator_membership'),
    (select id from site_ids where key = 'job_function'),
    true,
    (select id from site_ids where key = 'bodmin_packing')
  ) is not null,
  'Bodmin operator placed at Bodmin Packing'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_ids where key = 'exeter_operator_membership'),
    (select id from site_ids where key = 'job_function'),
    true,
    (select id from site_ids where key = 'exeter_packing')
  ) is not null,
  'Exeter operator placed at Exeter Packing'
);

select is(
  private.membership_home_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_operator_membership')
  ),
  (select id from site_ids where key = 'bodmin_site'),
  'Bodmin operator home site resolves to Bodmin'
);

select is(
  private.membership_home_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'exeter_operator_membership')
  ),
  (select id from site_ids where key = 'exeter_site'),
  'Exeter operator home site resolves to Exeter'
);

-- Maturity assessments in both sites
insert into site_ids (key, id)
select 'maturity_model', public.create_maturity_model_draft('CookieWorks Maturity');

insert into site_ids (key, id)
select 'maturity_model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from site_ids where key = 'organisation')
  and model_version.model_id = (select id from site_ids where key = 'maturity_model')
  and model_version.version_number = 1;

select ok(
  public.add_maturity_level(
    (select id from site_ids where key = 'maturity_model_version'),
    1,
    'Initial',
    'maturity-1'
  ) is not null,
  'maturity level added for publish'
);

insert into site_ids (key, id)
select 'maturity_pillar', public.add_maturity_pillar(
  (select id from site_ids where key = 'maturity_model_version'),
  'Operations',
  1,
  null,
  1,
  null,
  'Operations pillar'
);

select ok(
  public.publish_maturity_model_version((select id from site_ids where key = 'maturity_model_version')),
  'maturity model publishes'
);

insert into site_ids (key, id)
select 'bodmin_assessment', public.start_maturity_assessment(
  (select id from site_ids where key = 'maturity_model_version'),
  (select id from site_ids where key = 'bodmin_site'),
  'self', 'site'
);

insert into site_ids (key, id)
select 'exeter_assessment', public.start_maturity_assessment(
  (select id from site_ids where key = 'maturity_model_version'),
  (select id from site_ids where key = 'exeter_site'),
  'self', 'site'
);

select ok(
  (select site_unit_id from public.maturity_assessments
    where id = (select id from site_ids where key = 'bodmin_assessment'))
    = (select id from site_ids where key = 'bodmin_site'),
  'Bodmin assessment site ownership snapshotted'
);

-- Responsibility grants
insert into site_ids (key, id)
select 'maturity_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'maturity'
  and role_version.status = 'published';

insert into site_ids (key, id)
select 'five_s_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'five_s'
  and role_version.status = 'published';

insert into site_ids (key, id)
select 'projects_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'projects'
  and role_version.status = 'published';

insert into site_ids (key, id)
select 'suggestions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'suggestions'
  and role_version.status = 'published';

insert into site_ids (key, id)
select 'gemba_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'gemba'
  and role_version.status = 'published';

select ok(
  public.grant_role_version(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_maturity_membership'),
    (select id from site_ids where key = 'maturity_role_version'),
    'unit_subtree',
    (select id from site_ids where key = 'bodmin_site')
  ) is not null,
  'Bodmin Maturity Manager responsibility granted'
);

select ok(
  public.grant_role_version(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'group_ci_membership'),
    (select id from site_ids where key = 'projects_role_version'),
    'organisation',
    null
  ) is not null,
  'Group CI Projects responsibility at organisation scope'
);

-- Baseline read: Bodmin operator
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000002","email":"bodmin-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin operator selects organisation'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.read',
    null,
    (select id from site_ids where key = 'bodmin_site')
  ),
  'Bodmin operator baseline read within home site'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.read',
    null,
    (select id from site_ids where key = 'exeter_site')
  ),
  'Bodmin operator cannot baseline-read Exeter unit'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.read',
    null,
    null
  ),
  'Bodmin operator org-mode baseline does not grant record-wide read'
);

select is(
  (select count(*)::integer from public.maturity_assessments
    where id = (select id from site_ids where key = 'bodmin_assessment')),
  1,
  'Bodmin operator RLS can read Bodmin assessment'
);

select is(
  (select count(*)::integer from public.maturity_assessments
    where id = (select id from site_ids where key = 'exeter_assessment')),
  0,
  'Bodmin operator RLS cannot read Exeter assessment (direct UUID)'
);

-- Exeter operator
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000003","email":"exeter-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Exeter operator selects organisation'
);

select is(
  (select count(*)::integer from public.maturity_assessments
    where id = (select id from site_ids where key = 'exeter_assessment')),
  1,
  'Exeter operator RLS can read Exeter assessment'
);

select is(
  (select count(*)::integer from public.maturity_assessments
    where id = (select id from site_ids where key = 'bodmin_assessment')),
  0,
  'Exeter operator RLS cannot read Bodmin assessment'
);

-- Bodmin Maturity Manager — manage Bodmin, not Exeter
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000004","email":"bodmin-maturity@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin Maturity Manager selects organisation'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.assess.formal',
    null,
    (select id from site_ids where key = 'bodmin_production')
  ),
  'Bodmin Maturity Manager can manage Bodmin subtree'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.assess.formal',
    null,
    (select id from site_ids where key = 'exeter_packing')
  ),
  'Bodmin Maturity Manager cannot manage Exeter'
);

-- Group CI — organisation Projects crosses sites
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000006","email":"group-ci@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Group CI selects organisation'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'bodmin_site')
  ),
  'organisation-scoped Projects can manage Bodmin'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'exeter_site')
  ),
  'organisation-scoped Projects can manage Exeter'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.models.manage',
    null,
    (select id from site_ids where key = 'bodmin_site')
  ),
  'Projects grant does not widen Maturity authority'
);

-- Cross-site reparent blocked
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'owner re-selects organisation for hierarchy operations'
);

select throws_ok(
  format(
    'select public.move_organisation_unit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing'),
    (select id from site_ids where key = 'exeter_site')
  ),
  '23514',
  'cross-site unit reparent is not permitted',
  'cross-site reparent blocked for PR3 handoff'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_site')
  ),
  (select id from site_ids where key = 'bodmin_site'),
  'site unit resolves to itself'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_production')
  ),
  (select id from site_ids where key = 'bodmin_site'),
  'normal descendant resolves one site'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, %L, %L, %L)',
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_site'),
    'nested-site',
    'Nested Site',
    'site'
  ),
  '23514',
  'nested site units are not permitted',
  'nested site creation blocked under existing site ancestor'
);

-- Simulate malformed dual-site ancestry for hostile ambiguity contract.
set local role postgres;

insert into public.organisation_unit_closure (
  organisation_id,
  ancestor_unit_id,
  descendant_unit_id,
  depth
)
values (
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'exeter_site'),
  (select id from site_ids where key = 'bodmin_packing'),
  3
);

set local role authenticated;

select is(
  private.count_site_ancestors(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing')
  ),
  2,
  'malformed hierarchy exposes multiple site ancestors'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_packing')
  ),
  null,
  'ambiguous site ancestry fails closed'
);

set local role postgres;

delete from public.organisation_unit_closure
where organisation_id = (select id from site_ids where key = 'organisation')
  and ancestor_unit_id = (select id from site_ids where key = 'exeter_site')
  and descendant_unit_id = (select id from site_ids where key = 'bodmin_packing')
  and depth = 3;

set local role authenticated;

insert into site_ids (key, id)
select 'org_root_unit', public.create_organisation_unit(
  (select id from site_ids where key = 'organisation'),
  null,
  'org-root-dept',
  'Org Root Department',
  'department'
);

select is(
  private.resolve_site_unit_id(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'org_root_unit')
  ),
  null,
  'unit without site ancestry resolves null in boundary org'
);

select ok(
  not private.membership_can_access_unit_site(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_operator_membership'),
    (select id from site_ids where key = 'org_root_unit')
  ),
  'home site operator cannot access org-root unit without site ancestry'
);

-- Module matrix: seed representative records in both sites
insert into site_ids (key, id)
select 'five_s_standard', public.create_five_s_standard_draft('CookieWorks 5S', 'Two-site 5S', 90);

insert into site_ids (key, id)
select 'five_s_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from site_ids where key = 'five_s_standard')
  and version_row.version_number = 1;

insert into site_ids (key, id)
select 'five_s_section', public.add_five_s_section(
  (select id from site_ids where key = 'five_s_version'),
  'Sort',
  1
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Meets standard?'', 1, true, false, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from site_ids where key = 'five_s_version'),
    (select id from site_ids where key = 'five_s_section')
  ),
  '5S question added for publish'
);

select ok(
  public.publish_five_s_standard_version((select id from site_ids where key = 'five_s_version')),
  '5S standard publishes for two-site matrix'
);

insert into site_ids (key, id)
select 'bodmin_five_s_audit', public.start_five_s_audit(
  (select id from site_ids where key = 'five_s_standard'),
  (select id from site_ids where key = 'bodmin_packing')
);

insert into site_ids (key, id)
select 'exeter_five_s_audit', public.start_five_s_audit(
  (select id from site_ids where key = 'five_s_standard'),
  (select id from site_ids where key = 'exeter_packing')
);

insert into site_ids (key, id)
select 'suggestion_programme', public.create_suggestion_programme_draft(
  'CookieWorks Ideas', 'cw-ideas', 'Two-site suggestions'
);

insert into site_ids (key, id)
select 'suggestion_programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from site_ids where key = 'suggestion_programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from site_ids where key = 'suggestion_programme_version')),
  'suggestion programme publishes'
);

insert into site_ids (key, id)
select 'suggestion_category', public.create_suggestion_category('Safety', 'safety');

insert into site_ids (key, id)
select 'bodmin_suggestion', public.create_suggestion_draft(
  (select id from site_ids where key = 'suggestion_programme_version'),
  (select id from site_ids where key = 'suggestion_category'),
  'Bodmin suggestion',
  'Bodmin problem',
  'Bodmin idea',
  'Bodmin benefit',
  (select id from site_ids where key = 'bodmin_production')
);

insert into site_ids (key, id)
select 'exeter_suggestion', public.create_suggestion_draft(
  (select id from site_ids where key = 'suggestion_programme_version'),
  (select id from site_ids where key = 'suggestion_category'),
  'Exeter suggestion',
  'Exeter problem',
  'Exeter idea',
  'Exeter benefit',
  (select id from site_ids where key = 'exeter_packing')
);

select ok(
  public.submit_suggestion((select id from site_ids where key = 'bodmin_suggestion')),
  'Bodmin suggestion submits'
);

select ok(
  public.submit_suggestion((select id from site_ids where key = 'exeter_suggestion')),
  'Exeter suggestion submits'
);

insert into site_ids (key, id)
select 'bodmin_project', public.create_improvement_project(
  'Bodmin CI Project',
  (select id from site_ids where key = 'bodmin_site'),
  'Bodmin problem',
  'Bodmin goal',
  'Bodmin benefit'
);

insert into site_ids (key, id)
select 'exeter_project', public.create_improvement_project(
  'Exeter CI Project',
  (select id from site_ids where key = 'exeter_site'),
  'Exeter problem',
  'Exeter goal',
  'Exeter benefit'
);

insert into site_ids (key, id)
select 'bodmin_benefit', public.create_benefit_draft(
  'Bodmin Benefit',
  (select id from site_ids where key = 'bodmin_site'),
  'financial',
  'Bodmin benefit description',
  'hard_saving',
  null,
  null,
  null,
  true
);

insert into site_ids (key, id)
select 'exeter_benefit', public.create_benefit_draft(
  'Exeter Benefit',
  (select id from site_ids where key = 'exeter_site'),
  'financial',
  'Exeter benefit description',
  'hard_saving',
  null,
  null,
  null,
  true
);

insert into site_ids (key, id)
select 'bodmin_ps_case', public.create_problem_solving_case_draft(
  'Bodmin PS Case',
  (select id from site_ids where key = 'bodmin_production'),
  'Bodmin PS problem'
);

insert into site_ids (key, id)
select 'exeter_ps_case', public.create_problem_solving_case_draft(
  'Exeter PS Case',
  (select id from site_ids where key = 'exeter_packing'),
  'Exeter PS problem'
);

insert into site_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from site_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

select ok(
  public.activate_problem_solving_case(
    (select id from site_ids where key = 'bodmin_ps_case'),
    (select id from site_ids where key = 'rapid_method')
  ),
  'Bodmin problem solving case activates'
);

select ok(
  public.activate_problem_solving_case(
    (select id from site_ids where key = 'exeter_ps_case'),
    (select id from site_ids where key = 'rapid_method')
  ),
  'Exeter problem solving case activates'
);

insert into site_ids (key, id)
select 'bodmin_action', public.create_action(
  'Bodmin Action',
  null,
  'normal',
  (select id from site_ids where key = 'bodmin_packing')
);

insert into site_ids (key, id)
select 'exeter_action', public.create_action(
  'Exeter Action',
  null,
  'normal',
  (select id from site_ids where key = 'exeter_packing')
);

set local role postgres;

insert into public.action_assignees (
  organisation_id,
  action_id,
  membership_id,
  assigned_by_membership_id
)
values (
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'bodmin_action'),
  (select id from site_ids where key = 'bodmin_operator_membership'),
  (select id from site_ids where key = 'owner_membership')
);

set local role authenticated;

insert into site_ids (key, id)
select 'recognition_type', public.create_recognition_type('Teamwork', 'teamwork');

select ok(
  public.award_recognition(
    (select id from site_ids where key = 'recognition_type'),
    'Bodmin Award',
    'Great teamwork',
    (select id from site_ids where key = 'bodmin_site'),
    'organisation',
    array[(select id from site_ids where key = 'bodmin_operator_membership')]::uuid[]
  ) is not null,
  'Bodmin recognition award created'
);

insert into site_ids (key, id)
select 'exeter_recognition', public.award_recognition(
  (select id from site_ids where key = 'recognition_type'),
  'Exeter Award',
  'Great teamwork',
  (select id from site_ids where key = 'exeter_site'),
  'organisation',
  array[(select id from site_ids where key = 'exeter_operator_membership')]::uuid[]
);

-- Bodmin baseline matrix reads
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000002","email":"bodmin-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin operator re-selects organisation for module matrix'
);

select is(
  (select count(*)::integer from public.five_s_audits where id = (select id from site_ids where key = 'bodmin_five_s_audit')),
  1,
  'Bodmin operator reads Bodmin 5S audit'
);

select is(
  (select count(*)::integer from public.five_s_audits where id = (select id from site_ids where key = 'exeter_five_s_audit')),
  0,
  'Bodmin operator cannot read Exeter 5S audit'
);

select is(
  (select count(*)::integer from public.improvement_suggestions
    where id = (select id from site_ids where key = 'bodmin_suggestion')),
  0,
  'Bodmin operator cannot read foreign Bodmin suggestion without responsibility'
);

select is(
  (select count(*)::integer from public.improvement_suggestions
    where id = (select id from site_ids where key = 'exeter_suggestion')),
  0,
  'Bodmin operator cannot read Exeter suggestion'
);

select is(
  (select count(*)::integer from public.ci_projects where id = (select id from site_ids where key = 'bodmin_project')),
  1,
  'Bodmin operator baseline reads Bodmin project'
);

select is(
  (select count(*)::integer from public.ci_projects where id = (select id from site_ids where key = 'exeter_project')),
  0,
  'Bodmin operator cannot baseline-read Exeter project'
);

select is(
  (select count(*)::integer from public.improvement_benefits where id = (select id from site_ids where key = 'bodmin_benefit')),
  1,
  'Bodmin operator baseline reads Bodmin benefit'
);

select is(
  (select count(*)::integer from public.improvement_benefits where id = (select id from site_ids where key = 'exeter_benefit')),
  0,
  'Bodmin operator cannot baseline-read Exeter benefit'
);

select is(
  (select count(*)::integer from public.problem_solving_cases where id = (select id from site_ids where key = 'bodmin_ps_case')),
  1,
  'Bodmin operator baseline reads Bodmin problem solving case'
);

select is(
  (select count(*)::integer from public.problem_solving_cases where id = (select id from site_ids where key = 'exeter_ps_case')),
  0,
  'Bodmin operator cannot read Exeter problem solving case'
);

select is(
  (select count(*)::integer from public.actions where id = (select id from site_ids where key = 'bodmin_action')),
  1,
  'Bodmin operator reads assigned Bodmin action'
);

select is(
  (select count(*)::integer from public.actions where id = (select id from site_ids where key = 'exeter_action')),
  0,
  'Bodmin operator cannot read Exeter action'
);

select is(
  (select count(*)::integer from public.recognition_awards
    where organisational_unit_id = (select id from site_ids where key = 'bodmin_site')),
  1,
  'Bodmin operator reads Bodmin recognition award'
);

select is(
  (select count(*)::integer from public.recognition_awards where id = (select id from site_ids where key = 'exeter_recognition')),
  0,
  'Bodmin operator cannot read Exeter recognition award'
);

-- Exeter baseline symmetry
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000003","email":"exeter-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Exeter operator selects organisation for symmetry matrix'
);

select is(
  (select count(*)::integer from public.five_s_audits where id = (select id from site_ids where key = 'exeter_five_s_audit')),
  1,
  'Exeter operator reads Exeter 5S audit'
);

select is(
  (select count(*)::integer from public.five_s_audits where id = (select id from site_ids where key = 'bodmin_five_s_audit')),
  0,
  'Exeter operator cannot read Bodmin 5S audit'
);

-- Multi-responsibility persona
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'owner selects organisation for multi-responsibility grants'
);

select ok(
  public.grant_role_version(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'multi_resp_membership'),
    (select id from site_ids where key = 'suggestions_role_version'),
    'unit_subtree',
    (select id from site_ids where key = 'bodmin_production')
  ) is not null,
  'multi-resp suggestions grant at Bodmin Production'
);

insert into site_ids (key, id)
select 'multi_resp_gemba_grant', public.grant_role_version(
  (select id from site_ids where key = 'organisation'),
  (select id from site_ids where key = 'multi_resp_membership'),
  (select id from site_ids where key = 'gemba_role_version'),
  'unit_subtree',
  (select id from site_ids where key = 'exeter_site')
);

select ok(
  (select id from site_ids where key = 'multi_resp_gemba_grant') is not null,
  'multi-resp gemba grant at Exeter site'
);

select ok(
  public.grant_role_version(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'multi_resp_membership'),
    (select id from site_ids where key = 'projects_role_version'),
    'organisation',
    null
  ) is not null,
  'multi-resp projects grant at organisation scope'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_ids where key = 'multi_resp_membership'),
    (select id from site_ids where key = 'job_function'),
    true,
    (select id from site_ids where key = 'bodmin_packing')
  ) is not null,
  'multi-resp actor placed at Bodmin Packing'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000007","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000007","email":"multi-resp@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'multi-resp actor selects organisation'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'suggestions.manage',
    null,
    (select id from site_ids where key = 'bodmin_production')
  ),
  'multi-resp suggestions covers Bodmin Production'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'suggestions.manage',
    null,
    (select id from site_ids where key = 'exeter_packing')
  ),
  'multi-resp suggestions does not cover Exeter'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'gemba.walk.review',
    null,
    (select id from site_ids where key = 'exeter_packing')
  ),
  'multi-resp gemba covers Exeter'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'gemba.walk.review',
    null,
    (select id from site_ids where key = 'bodmin_packing')
  ),
  'multi-resp gemba does not cover Bodmin'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'exeter_site')
  ),
  'multi-resp projects organisation scope covers Exeter'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    null
  ) or private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'bodmin_site')
  ),
  'projects organisation scope does not require null-unit baseline bypass'
);

-- Revoke gemba grant and prove other responsibilities remain
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);

select ok(
  public.revoke_access_grant(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'multi_resp_gemba_grant'),
    'revoke gemba for multi-resp isolation test'
  ),
  'gemba grant revoked for multi-resp persona'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000007","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000007","email":"multi-resp@example.test"}',
  true
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'gemba.walk.review',
    null,
    (select id from site_ids where key = 'exeter_packing')
  ),
  'revoked gemba responsibility disappears immediately'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'suggestions.manage',
    null,
    (select id from site_ids where key = 'bodmin_production')
  ),
  'suggestions responsibility remains after gemba revoke'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'bodmin_site')
  ),
  'projects responsibility remains after gemba revoke'
);

-- Child UUID leakage hostile probes (seed hidden Exeter children as owner first)
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'owner selects organisation to seed hidden Exeter child records'
);

select lives_ok(
  format(
    'select public.create_comment(%L::uuid, %L)',
    (select id from site_ids where key = 'exeter_action'),
    'Exeter action comment'
  ),
  'owner creates Exeter action comment child'
);

select lives_ok(
  format(
    'select public.create_current_condition_item(%L::uuid, %L, %L)',
    (select id from site_ids where key = 'exeter_ps_case'),
    'observation',
    'Hidden Exeter PS child'
  ),
  'owner creates Exeter problem solving child item'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000002","email":"bodmin-operator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin operator selects organisation for child leakage probes'
);

select is(
  (select count(*)::integer from public.comments
    where resource_id = (select id from site_ids where key = 'exeter_action')),
  0,
  'Bodmin actor cannot read Exeter action child comments by resource id'
);

select is(
  (select count(*)::integer from public.problem_solving_current_condition_items
    where case_id = (select id from site_ids where key = 'exeter_ps_case')),
  0,
  'Bodmin actor cannot read Exeter problem solving child rows'
);

select is(
  (select count(*)::integer from public.improvement_suggestions
    where id = (select id from site_ids where key = 'exeter_suggestion')),
  0,
  'Bodmin actor cannot read Exeter suggestion by known UUID'
);

-- Anchor/site consistency enforcement
select throws_ok(
  format(
    'update public.maturity_assessments set unit_id = %L::uuid where id = %L::uuid',
    (select id from site_ids where key = 'exeter_site'),
    (select id from site_ids where key = 'bodmin_assessment')
  ),
  '23514',
  'cross-site operational record move is not permitted',
  'cross-site unit anchor update blocked'
);

select throws_ok(
  format(
    'update public.maturity_assessments set site_unit_id = %L::uuid where id = %L::uuid',
    (select id from site_ids where key = 'exeter_site'),
    (select id from site_ids where key = 'bodmin_assessment')
  ),
  '23514',
  'site ownership is immutable on operational records',
  'site snapshot rewrite blocked'
);

-- Directory enumeration containment
select is(
  (
    select count(*)::integer
    from public.organisation_units unit_row
    where unit_row.organisation_id = (select id from site_ids where key = 'organisation')
      and unit_row.code = 'exeter-factory'
  ),
  0,
  'Bodmin operator cannot enumerate Exeter site via organisation_units'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000008","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000008","email":"bodmin-people@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin people manager selects organisation for scope picker audit'
);

select is(
  (
    select count(*)::integer
    from public.get_delegatable_access_offers() -> 'offers' offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'unit_code' = 'exeter-factory'
  ),
  0,
  'Bodmin people manager delegation picker excludes Exeter subtree targets'
);

-- Invitation / provisioning hostile tests
insert into site_ids (key, id)
select 'people_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
);

select ok(
  public.grant_role_version(
    (select id from site_ids where key = 'organisation'),
    (select id from site_ids where key = 'bodmin_people_membership'),
    (select id from site_ids where key = 'people_role_version'),
    'unit_subtree',
    (select id from site_ids where key = 'bodmin_site')
  ) is not null,
  'Bodmin people manager delegated at Bodmin site'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_ids where key = 'bodmin_people_membership'),
    (select id from site_ids where key = 'job_function'),
    true,
    (select id from site_ids where key = 'bodmin_packing')
  ) is not null,
  'Bodmin people manager placed at Bodmin Packing'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000008","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000008","email":"bodmin-people@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_ids where key = 'organisation')),
  'Bodmin people manager selects organisation'
);

select throws_ok(
  format(
    'select public.issue_organisation_member_invitation(%L, %L, %s, %L::timestamptz, %L::uuid, %L, %L::uuid, %L, %L::uuid, %L::uuid)',
    'email',
    'exeter-invite@example.test',
    'decode(''00'', ''hex'')',
    statement_timestamp() + interval '7 days',
    (select id from site_ids where key = 'people_role_version'),
    'unit_subtree',
    (select id from site_ids where key = 'exeter_site'),
    'Exeter Invitee',
    (select id from site_ids where key = 'job_function'),
    (select id from site_ids where key = 'exeter_packing')
  ),
  '42501',
  'membership placement is outside authorised site boundary',
  'Bodmin people manager cannot provision into Exeter'
);

select throws_ok(
  format(
    'select public.issue_organisation_member_invitation(%L, %L, %s, %L::timestamptz, %L::uuid, %L, %L::uuid, null, null, null)',
    'email',
    'exeter-grant@example.test',
    'decode(''01'', ''hex'')',
    statement_timestamp() + interval '7 days',
    (select id from site_ids where key = 'people_role_version'),
    'unit_subtree',
    (select id from site_ids where key = 'exeter_site')
  ),
  '42501',
  'grant scope is outside authorised site boundary',
  'Bodmin people manager cannot delegate Exeter unit_subtree grant'
);

-- Site ownership immutability trigger installed on operational records
select ok(
  exists (
    select 1
    from pg_trigger trigger_row
    join pg_class class_row on class_row.oid = trigger_row.tgrelid
    where class_row.relname = 'maturity_assessments'
      and trigger_row.tgname = 'maturity_assessments_prevent_site_change'
      and not trigger_row.tgisinternal
  ),
  'historical site ownership immutability trigger is installed'
);

set local role authenticated;

select * from finish();
rollback;
