begin;

select plan(42);

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
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000006', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select (select id from site_ids where key = 'organisation'), user_id, 'active', statement_timestamp()
from (values
  ('b1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000004'),
  ('b1000000-0000-0000-0000-000000000005'),
  ('b1000000-0000-0000-0000-000000000006')
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
  'b1000000-0000-0000-0000-000000000006'
);

insert into site_ids (key, id)
select key, membership.id
from (
  values
    ('bodmin_operator_membership', 'b1000000-0000-0000-0000-000000000002'),
    ('exeter_operator_membership', 'b1000000-0000-0000-0000-000000000003'),
    ('bodmin_maturity_membership', 'b1000000-0000-0000-0000-000000000004'),
    ('exeter_5s_membership', 'b1000000-0000-0000-0000-000000000005'),
    ('group_ci_membership', 'b1000000-0000-0000-0000-000000000006')
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
  public.publish_maturity_model_version((select id from site_ids where key = 'maturity_model_version')),
  'maturity model publishes'
);

insert into site_ids (key, id)
select 'bodmin_assessment', public.start_maturity_assessment(
  (select id from site_ids where key = 'maturity_model_version'),
  (select id from site_ids where key = 'bodmin_packing'),
  'self', 'site'
);

insert into site_ids (key, id)
select 'exeter_assessment', public.start_maturity_assessment(
  (select id from site_ids where key = 'maturity_model_version'),
  (select id from site_ids where key = 'exeter_packing'),
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
    (select id from site_ids where key = 'bodmin_packing')
  ),
  'Bodmin operator baseline read within home site'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.read',
    null,
    (select id from site_ids where key = 'exeter_packing')
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
    (select id from site_ids where key = 'bodmin_packing')
  ),
  'organisation-scoped Projects can manage Bodmin'
);

select ok(
  private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'projects.manage',
    null,
    (select id from site_ids where key = 'exeter_packing')
  ),
  'organisation-scoped Projects can manage Exeter'
);

select ok(
  not private.has_scoped_permission(
    (select id from site_ids where key = 'organisation'),
    'maturity.models.manage',
    null,
    (select id from site_ids where key = 'bodmin_packing')
  ),
  'Projects grant does not widen Maturity authority'
);

-- Cross-site reparent blocked
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1000000-0000-0000-0000-000000000001","email":"cw-owner@example.test"}',
  true
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

-- Site ownership immutability
select throws_ok(
  format(
    'update public.maturity_assessments set site_unit_id = %L where id = %L',
    (select id from site_ids where key = 'exeter_site'),
    (select id from site_ids where key = 'bodmin_assessment')
  ),
  '23514',
  'site ownership is immutable on operational records',
  'historical site ownership cannot be mutated'
);

select * from finish();
rollback;
