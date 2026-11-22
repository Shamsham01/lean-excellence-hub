-- VERIFY draft for PR #392 (Spec B): skills requirement unit-scope matrix.
-- Complements skills_requirement_unit_scope.test.sql in the PR (11 asserts:
-- descendant inherits site target, sibling keeps org-wide, grants). This file
-- adds: null unit, wrong job function, tighten + relax with P1 fields
-- (effective_requirement_id / org_wide_requirement_id / org_wide_target_order /
-- effective_below_org), the NULLS NOT DISTINCT unique index, get_skills_matrix
-- column scoping (>12 skills, per-page columns), pagination, and 42501s.
-- Written against #391 + #392 public API; uses only public.* RPCs at runtime.
begin;

select plan(50);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('93810000-0000-0000-0000-000000000001', 'skill-scope-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000002', 'skill-scope-bodmin-line-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000003', 'skill-scope-bodmin-site-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000004', 'skill-scope-exeter-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000005', 'skill-scope-null-unit-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000006', 'skill-scope-bodmin-packer@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000007', 'skill-scope-bodmin-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93810000-0000-0000-0000-000000000008', 'skill-scope-outsider@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table skill_scope_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on skill_scope_ids to authenticated;

create temporary table skill_scope_ids_payload (
  key text primary key,
  payload jsonb
) on commit drop;

grant select, insert on skill_scope_ids_payload to authenticated;

insert into skill_scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation('93810000-0000-0000-0000-000000000001', 'skill-scope-org', 'Skill-Scope Organisation')
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('93820000-0000-0000-0000-000000000001', '93810000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000002', '93810000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000003', '93810000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000004', '93810000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000005', '93810000-0000-0000-0000-000000000005', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000006', '93810000-0000-0000-0000-000000000006', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000007', '93810000-0000-0000-0000-000000000007', statement_timestamp(), statement_timestamp()),
  ('93820000-0000-0000-0000-000000000008', '93810000-0000-0000-0000-000000000008', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, display_name, status, activated_at)
select (select id from skill_scope_ids where key = 'organisation'), members.user_id::uuid, members.display_name, 'active', statement_timestamp()
from (values
  ('93810000-0000-0000-0000-000000000002', 'A Bodmin Line Operator'),
  ('93810000-0000-0000-0000-000000000003', 'B Bodmin Site Operator'),
  ('93810000-0000-0000-0000-000000000004', 'C Exeter Operator'),
  ('93810000-0000-0000-0000-000000000005', 'D Null Unit Operator'),
  ('93810000-0000-0000-0000-000000000006', 'E Bodmin Packer'),
  ('93810000-0000-0000-0000-000000000007', 'F Bodmin Manager'),
  ('93810000-0000-0000-0000-000000000008', 'G Outsider')
) as members(user_id, display_name);

update public.organisation_memberships
set display_name = 'H Owner'
where organisation_id = (select id from skill_scope_ids where key = 'organisation')
  and user_id = '93810000-0000-0000-0000-000000000001';

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '93810000-0000-0000-0000-000000000002',
  '93810000-0000-0000-0000-000000000003',
  '93810000-0000-0000-0000-000000000004',
  '93810000-0000-0000-0000-000000000005',
  '93810000-0000-0000-0000-000000000006',
  '93810000-0000-0000-0000-000000000007',
  '93810000-0000-0000-0000-000000000008'
);

insert into skill_scope_ids (key, id)
select mapping.key, membership.id
from (values
  ('owner', '93810000-0000-0000-0000-000000000001'),
  ('bodmin_line_op', '93810000-0000-0000-0000-000000000002'),
  ('bodmin_site_op', '93810000-0000-0000-0000-000000000003'),
  ('exeter_op', '93810000-0000-0000-0000-000000000004'),
  ('null_unit_op', '93810000-0000-0000-0000-000000000005'),
  ('bodmin_packer', '93810000-0000-0000-0000-000000000006'),
  ('bodmin_manager', '93810000-0000-0000-0000-000000000007'),
  ('outsider', '93810000-0000-0000-0000-000000000008')
) as mapping(key, user_id)
join public.organisation_memberships membership
  on membership.organisation_id = (select id from skill_scope_ids where key = 'organisation')
 and membership.user_id = mapping.user_id::uuid;

insert into skill_scope_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from skill_scope_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93810000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93820000-0000-0000-0000-000000000001","email":"skill-scope-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from skill_scope_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into skill_scope_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from skill_scope_ids where key = 'organisation'), null, 'bodmin', 'Bodmin', 'site'
);

insert into skill_scope_ids (key, id)
select 'bodmin_line', public.create_organisation_unit(
  (select id from skill_scope_ids where key = 'organisation'),
  (select id from skill_scope_ids where key = 'bodmin_site'),
  'bodmin-line-3', 'Bodmin Line 3', 'department'
);

insert into skill_scope_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from skill_scope_ids where key = 'organisation'), null, 'exeter', 'Exeter', 'site'
);

insert into skill_scope_ids (key, id)
select 'jf_operator', public.create_job_function('Operator', 'operator-scope');
insert into skill_scope_ids (key, id)
select 'jf_packer', public.create_job_function('Packer', 'packer-scope');
insert into skill_scope_ids (key, id)
select 'jf_supervisor', public.create_job_function('Supervisor', 'supervisor-scope');

-- Primary placements. null_unit_op has a job function but no unit;
-- owner and outsider have no assignment at all.
select public.assign_membership_job_function(
  (select id from skill_scope_ids where key = placement.membership_key),
  (select id from skill_scope_ids where key = placement.job_function_key),
  true,
  (select id from skill_scope_ids where key = placement.unit_key)
)
from (values
  ('bodmin_line_op', 'jf_operator', 'bodmin_line'),
  ('bodmin_site_op', 'jf_operator', 'bodmin_site'),
  ('exeter_op', 'jf_operator', 'exeter_site'),
  ('bodmin_packer', 'jf_packer', 'bodmin_site'),
  ('bodmin_manager', 'jf_supervisor', 'bodmin_site')
) as placement(membership_key, job_function_key, unit_key);

reset role;
insert into public.membership_job_function_assignments (
  organisation_id,
  membership_id,
  job_function_id,
  organisational_unit_id,
  is_primary,
  job_function_name_snapshot,
  job_function_code_snapshot,
  assigned_by_membership_id
)
values (
  (select id from skill_scope_ids where key = 'organisation'),
  (select id from skill_scope_ids where key = 'null_unit_op'),
  (select id from skill_scope_ids where key = 'jf_operator'),
  null,
  true,
  'Operator',
  'operator-scope',
  (select membership_row.id
   from public.organisation_memberships membership_row
   where membership_row.organisation_id = (select id from skill_scope_ids where key = 'organisation')
     and membership_row.user_id = '93810000-0000-0000-0000-000000000001')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93810000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93820000-0000-0000-0000-000000000001","email":"skill-scope-owner@example.test"}',
  true
);
set local role authenticated;
select ok(public.switch_organisation((select id from skill_scope_ids where key = 'organisation')), 're-select organisation after null-unit placement');

select ok(
  public.grant_role_version(
    (select id from skill_scope_ids where key = 'organisation'),
    (select id from skill_scope_ids where key = 'bodmin_manager'),
    (select id from skill_scope_ids where key = 'manager_role_version'),
    'unit_subtree',
    (select id from skill_scope_ids where key = 'bodmin_site')
  ) is not null,
  'Bodmin site manager granted Manager at unit_subtree(Bodmin)'
);

insert into skill_scope_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Scope Scale');
insert into skill_scope_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skill_scope_ids where key = 'scale') and version_row.version_number = 1;
select public.add_skill_proficiency_level((select id from skill_scope_ids where key = 'scale_version'), 1, 'Trained');
select public.add_skill_proficiency_level((select id from skill_scope_ids where key = 'scale_version'), 2, 'To standard');
select public.add_skill_proficiency_level((select id from skill_scope_ids where key = 'scale_version'), 3, 'Independent');
select public.publish_skill_proficiency_scale_version((select id from skill_scope_ids where key = 'scale_version'));
insert into skill_scope_ids (key, id)
select 'l' || level_row.order_value, level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skill_scope_ids where key = 'scale_version');

insert into skill_scope_ids (key, id)
select skill_def.key, public.create_skill(skill_def.name, skill_def.code)
from (values
  ('s_oven', 'Oven control', 'oven-control'),
  ('s_mixer', 'Mixer changeover', 'mixer-changeover'),
  ('s_bodmin', 'Bodmin allergen line', 'bodmin-allergen'),
  ('s_pack', 'Case packing', 'case-packing'),
  ('f01', 'Filler skill 01', 'filler-skill-01'),
  ('f02', 'Filler skill 02', 'filler-skill-02'),
  ('f03', 'Filler skill 03', 'filler-skill-03'),
  ('f04', 'Filler skill 04', 'filler-skill-04'),
  ('f05', 'Filler skill 05', 'filler-skill-05'),
  ('f06', 'Filler skill 06', 'filler-skill-06'),
  ('f07', 'Filler skill 07', 'filler-skill-07'),
  ('f08', 'Filler skill 08', 'filler-skill-08'),
  ('f09', 'Filler skill 09', 'filler-skill-09'),
  ('f10', 'Filler skill 10', 'filler-skill-10'),
  ('f11', 'Filler skill 11', 'filler-skill-11')
) as skill_def(key, name, code);

insert into skill_scope_ids (key, id)
select 'capability_set', public.create_skill_capability_set_draft('Scope Standard', 'scope-standard');
insert into skill_scope_ids (key, id)
select 'capability_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skill_scope_ids where key = 'capability_set') and version_row.version_number = 1;

-- Requirement rows (key, skill, job function, unit, level):
--   org-wide operator: s_oven L2, s_mixer L3, 11 fillers L1
--   Bodmin site operator: s_oven L3 (tighten), s_mixer L1 (relax), s_bodmin L2 (site-only)
--   org-wide packer: s_pack L1
insert into skill_scope_ids (key, id)
select requirement_def.key, public.add_skill_requirement(
  (select id from skill_scope_ids where key = 'capability_version'),
  (select id from skill_scope_ids where key = requirement_def.skill_key),
  (select id from skill_scope_ids where key = requirement_def.job_function_key),
  (select id from skill_scope_ids where key = 'scale_version'),
  (select id from skill_scope_ids where key = requirement_def.level_key),
  (select id from skill_scope_ids where key = requirement_def.unit_key)
)
from (values
  ('r_org_oven', 's_oven', 'jf_operator', 'l2', null),
  ('r_org_mixer', 's_mixer', 'jf_operator', 'l3', null),
  ('r_bodmin_oven', 's_oven', 'jf_operator', 'l3', 'bodmin_site'),
  ('r_bodmin_mixer', 's_mixer', 'jf_operator', 'l1', 'bodmin_site'),
  ('r_bodmin_only', 's_bodmin', 'jf_operator', 'l2', 'bodmin_site'),
  ('r_org_pack', 's_pack', 'jf_packer', 'l1', null),
  ('r_f01', 'f01', 'jf_operator', 'l1', null),
  ('r_f02', 'f02', 'jf_operator', 'l1', null),
  ('r_f03', 'f03', 'jf_operator', 'l1', null),
  ('r_f04', 'f04', 'jf_operator', 'l1', null),
  ('r_f05', 'f05', 'jf_operator', 'l1', null),
  ('r_f06', 'f06', 'jf_operator', 'l1', null),
  ('r_f07', 'f07', 'jf_operator', 'l1', null),
  ('r_f08', 'f08', 'jf_operator', 'l1', null),
  ('r_f09', 'f09', 'jf_operator', 'l1', null),
  ('r_f10', 'f10', 'jf_operator', 'l1', null),
  ('r_f11', 'f11', 'jf_operator', 'l1', null)
) as requirement_def(key, skill_key, job_function_key, level_key, unit_key);

select ok(
  public.publish_skill_capability_set_version((select id from skill_scope_ids where key = 'capability_version')),
  'publish capability standard with org-wide + Bodmin rows'
);

-- 1. Null unit and wrong job function -------------------------------------

select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'null_unit_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'target_order', '2',
  'null assignment unit: org-wide target applies (2), Bodmin tightening ignored');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'null_unit_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'effective_requirement_id', (select id from skill_scope_ids where key = 'r_org_oven')::text,
  'null assignment unit: effective requirement is the org-wide row');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'null_unit_op'), (select id from skill_scope_ids where key = 's_bodmin')) ->> 'status', 'not_required',
  'null assignment unit: Bodmin-only requirement does not apply');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'exeter_op'), (select id from skill_scope_ids where key = 's_bodmin')) ->> 'status', 'not_required',
  'sibling site: Bodmin-only requirement does not apply');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_site_op'), (select id from skill_scope_ids where key = 's_bodmin')) ->> 'target_order', '2',
  'site unit itself (closure depth 0) receives the site-only requirement');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_packer'), (select id from skill_scope_ids where key = 's_oven')) ->> 'status', 'not_required',
  'wrong job function at Bodmin: operator requirement does not apply');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_pack')) ->> 'status', 'not_required',
  'wrong job function: packer requirement does not apply to an operator');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'outsider'), (select id from skill_scope_ids where key = 's_oven')) ->> 'status', 'not_required',
  'no primary assignment: nothing is required');

-- 2. Tightening (Bodmin 3 over org 2) -------------------------------------

select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'target_order', '3',
  'tighten: Bodmin Line 3 (descendant) gets the stricter site target 3');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'effective_requirement_id', (select id from skill_scope_ids where key = 'r_bodmin_oven')::text,
  'tighten: effective requirement is the Bodmin row');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'org_wide_requirement_id', (select id from skill_scope_ids where key = 'r_org_oven')::text,
  'tighten: org-wide comparison row is exposed for P1');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'org_wide_target_order', '2',
  'tighten: org-wide target order exposed (2)');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_oven')) ->> 'effective_below_org', 'false',
  'tighten: effective_below_org is false');

-- 3. Relaxing (Bodmin 1 under org 3) --------------------------------------

select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_mixer')) ->> 'target_order', '1',
  'relax: Bodmin person gets the looser site target (most specific wins)');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_mixer')) ->> 'effective_below_org', 'true',
  'relax: effective_below_org is true so P1 can show "site override of org requirement (was X)"');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 's_mixer')) ->> 'org_wide_target_order', '3',
  'relax: org-wide target order (X = 3) is available for the P1 copy');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'exeter_op'), (select id from skill_scope_ids where key = 's_mixer')) ->> 'target_order', '3',
  'relax does not leak: Exeter keeps the org-wide target 3');
select is(public.derive_skill_gap((select id from skill_scope_ids where key = 'exeter_op'), (select id from skill_scope_ids where key = 's_mixer')) ->> 'effective_below_org', 'false',
  'Exeter (org-wide effective) is not flagged below org');

-- 4. Unique index (NULLS NOT DISTINCT) ------------------------------------

reset role;

select ok(
  exists (
    select 1
    from pg_catalog.pg_index index_row
    join pg_catalog.pg_class index_class on index_class.oid = index_row.indexrelid
    where index_class.relname = 'skill_requirements_scope_unique_idx'
      and index_row.indisunique
      and index_row.indnullsnotdistinct
      and index_row.indrelid = 'public.skill_requirements'::regclass
  ),
  'skill_requirements_scope_unique_idx is UNIQUE NULLS NOT DISTINCT'
);

select is(
  (
    select array_agg(attribute_row.attname::text order by key_column.ordinality)
    from pg_catalog.pg_index index_row
    join pg_catalog.pg_class index_class on index_class.oid = index_row.indexrelid
    cross join lateral unnest(index_row.indkey) with ordinality as key_column(attnum, ordinality)
    join pg_catalog.pg_attribute attribute_row
      on attribute_row.attrelid = index_row.indrelid
     and attribute_row.attnum = key_column.attnum
    where index_class.relname = 'skill_requirements_scope_unique_idx'
  ),
  array['organisation_id', 'capability_set_version_id', 'skill_id', 'job_function_id', 'organisational_unit_id'],
  'skill scope key columns match Spec B (tenant-leading)'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93810000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93820000-0000-0000-0000-000000000001","email":"skill-scope-owner@example.test"}',
  true
);
set local role authenticated;

insert into skill_scope_ids (key, id)
select 'dup_set', public.create_skill_capability_set_draft('Duplicate probe', 'duplicate-probe');
insert into skill_scope_ids (key, id)
select 'dup_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skill_scope_ids where key = 'dup_set') and version_row.version_number = 1;

select ok(
  public.add_skill_requirement((select id from skill_scope_ids where key = 'dup_version'), (select id from skill_scope_ids where key = 's_oven'), (select id from skill_scope_ids where key = 'jf_operator'), (select id from skill_scope_ids where key = 'scale_version'), (select id from skill_scope_ids where key = 'l2')) is not null,
  'first org-wide row in a draft is accepted'
);

select throws_ok(
  format(
    'select public.add_skill_requirement(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    (select id from skill_scope_ids where key = 'dup_version'), (select id from skill_scope_ids where key = 's_oven'), (select id from skill_scope_ids where key = 'jf_operator'), (select id from skill_scope_ids where key = 'scale_version'), (select id from skill_scope_ids where key = 'l3')
  ),
  '23505',
  null,
  'second org-wide row (unit NULL) for the same key is rejected: NULLs are not distinct'
);

select lives_ok(
  format(
    'select public.add_skill_requirement(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    (select id from skill_scope_ids where key = 'dup_version'), (select id from skill_scope_ids where key = 's_oven'), (select id from skill_scope_ids where key = 'jf_operator'), (select id from skill_scope_ids where key = 'scale_version'), (select id from skill_scope_ids where key = 'l3'), (select id from skill_scope_ids where key = 'bodmin_site')
  ),
  'a site row for the same skill/job function is a distinct key (override allowed)'
);

select throws_ok(
  format(
    'select public.add_skill_requirement(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    (select id from skill_scope_ids where key = 'dup_version'), (select id from skill_scope_ids where key = 's_oven'), (select id from skill_scope_ids where key = 'jf_operator'), (select id from skill_scope_ids where key = 'scale_version'), (select id from skill_scope_ids where key = 'l1'), (select id from skill_scope_ids where key = 'bodmin_site')
  ),
  '23505',
  null,
  'a second Bodmin row for the same key is rejected'
);

-- 5. get_skills_matrix: columns, scoping, pagination (owner) ---------------

insert into skill_scope_ids_payload (key, payload)
values
  ('owner_all', public.get_skills_matrix(1, 100)),
  ('owner_p1s1', public.get_skills_matrix(1, 1)),
  ('owner_p3s1', public.get_skills_matrix(3, 1)),
  ('owner_p5s1', public.get_skills_matrix(5, 1)),
  ('owner_p1s3', public.get_skills_matrix(1, 3)),
  ('owner_p2s3', public.get_skills_matrix(2, 3)),
  ('owner_p9s3', public.get_skills_matrix(9, 3)),
  ('owner_big', public.get_skills_matrix(1, 1000)),
  ('owner_p0', public.get_skills_matrix(0, 50));

select is(jsonb_array_length((select payload from skill_scope_ids_payload where key = 'owner_all') -> 'skills'), 15,
  'owner, all people: all 15 required skills are columns (no silent 12 cap)');
select is(((select payload from skill_scope_ids_payload where key = 'owner_all') ->> 'total_people')::integer, 8,
  'owner sees all 8 active members (including those with nothing required)');
select is(
  (select array_agg(person ->> 'display_name') from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p1s1') -> 'people') person),
  array['A Bodmin Line Operator'],
  'people are ordered by display name (page 1 of size 1)'
);
select is(jsonb_array_length((select payload from skill_scope_ids_payload where key = 'owner_p1s1') -> 'skills'), 14,
  'Bodmin Line operator page: 13 org-wide + 1 Bodmin-only skill = 14 columns');
select is(jsonb_array_length((select payload from skill_scope_ids_payload where key = 'owner_p3s1') -> 'skills'), 13,
  'Exeter operator page: 13 columns, Bodmin-only skill not listed');
select ok(
  not exists (
    select 1 from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p3s1') -> 'skills') skill
    where (skill ->> 'id')::uuid = (select id from skill_scope_ids where key = 's_bodmin')
  ),
  'Exeter page does not carry the Bodmin-only column'
);
select is(
  (select array_agg(skill ->> 'id') from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p5s1') -> 'skills') skill),
  array[(select id from skill_scope_ids where key = 's_pack')::text],
  'packer page: only the packer skill is a column (columns follow the page)'
);
select is(
  (
    select (cell -> 'gap' ->> 'effective_below_org')
    from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p1s1') -> 'gaps') cell
    where (cell ->> 'skill_id')::uuid = (select id from skill_scope_ids where key = 's_mixer')
  ),
  'true',
  'matrix gap payload carries effective_below_org for the relaxed Bodmin cell'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p1s3') -> 'people') page_one
    join jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'owner_p2s3') -> 'people') page_two
      on page_one ->> 'membership_id' = page_two ->> 'membership_id'
  ),
  0,
  'pages 1 and 2 are disjoint'
);
select is(jsonb_array_length((select payload from skill_scope_ids_payload where key = 'owner_p9s3') -> 'people'), 0,
  'page past the end returns no people (and does not error)');
select is(((select payload from skill_scope_ids_payload where key = 'owner_big') ->> 'page_size')::integer, 100,
  'page size is clamped to the documented hard cap of 100');
select is(((select payload from skill_scope_ids_payload where key = 'owner_p0') ->> 'page')::integer, 1,
  'page 0 is treated as page 1');

-- 6. Site manager scoping and 42501 ---------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93810000-0000-0000-0000-000000000007","role":"authenticated","session_id":"93820000-0000-0000-0000-000000000007","email":"skill-scope-bodmin-manager@example.test"}',
  true
);
set local role authenticated;

select ok(public.switch_organisation((select id from skill_scope_ids where key = 'organisation')), 'Bodmin manager selects organisation');

insert into skill_scope_ids_payload (key, payload)
values
  ('manager_all', public.get_skills_matrix(1, 100)),
  ('manager_bodmin', public.get_skills_matrix(1, 100, (select id from skill_scope_ids where key = 'bodmin_site'))),
  ('manager_line', public.get_skills_matrix(1, 100, (select id from skill_scope_ids where key = 'bodmin_line')));

select is(
  (
    select array_agg((person ->> 'membership_id')::uuid order by person ->> 'display_name')
    from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'manager_all') -> 'people') person
  ),
  array[(select id from skill_scope_ids where key = 'bodmin_line_op'), (select id from skill_scope_ids where key = 'bodmin_site_op'), (select id from skill_scope_ids where key = 'bodmin_packer'), (select id from skill_scope_ids where key = 'bodmin_manager')],
  'Bodmin manager (no unit filter) sees only Bodmin-subtree people'
);
select is(((select payload from skill_scope_ids_payload where key = 'manager_bodmin') ->> 'total_people')::integer, 4,
  'Bodmin manager filtered to Bodmin: 4 people');
select is(
  (select array_agg((person ->> 'membership_id')::uuid) from jsonb_array_elements((select payload from skill_scope_ids_payload where key = 'manager_line') -> 'people') person),
  array[(select id from skill_scope_ids where key = 'bodmin_line_op')],
  'Bodmin manager filtered to Bodmin Line 3 (child unit): only the line operator'
);
select throws_ok(
  format('select public.get_skills_matrix(1, 50, %L::uuid)', (select id from skill_scope_ids where key = 'exeter_site')),
  '42501',
  'skills matrix is not authorised for this unit',
  'Bodmin manager cannot widen to the Exeter site'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93810000-0000-0000-0000-000000000008","role":"authenticated","session_id":"93820000-0000-0000-0000-000000000008","email":"skill-scope-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(public.switch_organisation((select id from skill_scope_ids where key = 'organisation')), 'outsider (no grants) selects organisation');
select throws_ok(
  'select public.get_skills_matrix()',
  '42501',
  'skills matrix is not authorised',
  'member without skills.read gets 42501 from get_skills_matrix'
);

reset role;
select ok(
  not pg_catalog.has_function_privilege('anon', 'public.get_skills_matrix(integer, integer, uuid)', 'execute'),
  'anon cannot execute get_skills_matrix'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc proc_row
    cross join lateral aclexplode(coalesce(proc_row.proacl, acldefault('f', proc_row.proowner))) acl_row
    where proc_row.oid in (
        'private.get_skills_matrix(integer, integer, uuid)'::regprocedure,
        'private.get_training_matrix(integer, integer, uuid)'::regprocedure,
        'private.requirement_unit_applies(uuid, uuid, uuid)'::regprocedure,
        'private.resolve_effective_skill_requirement(uuid, uuid, uuid, uuid, uuid)'::regprocedure,
        'private.resolve_effective_training_requirement(uuid, uuid, uuid, uuid, uuid)'::regprocedure
      )
      and acl_row.grantee = 0
      and acl_row.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no direct EXECUTE on the revoked Spec B private helpers (fixed in a016e659)'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc proc_row
    cross join lateral aclexplode(coalesce(proc_row.proacl, acldefault('f', proc_row.proowner))) acl_row
    where proc_row.oid = 'private.build_skill_gap_from_resolution(uuid, uuid, uuid, jsonb)'::regprocedure
      and acl_row.grantee = 0
      and acl_row.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no direct EXECUTE on private.build_skill_gap_from_resolution'
);

select * from finish();
rollback;
