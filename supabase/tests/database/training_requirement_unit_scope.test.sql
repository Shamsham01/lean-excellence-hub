-- VERIFY draft for PR #392 (Spec B): training requirement unit scope,
-- latest curriculum, compliance summary (null vs site unit) and 42501s.
-- New file: PR #392 has no training pgTAP. Uses public.get_training_matrix and
-- public.get_training_compliance_summary; one assertion calls
-- private.resolve_effective_training_requirement(org, curriculum_version,
-- course, job_function, person_unit) as the owner role (signature at 962e8a2c).
begin;

select plan(45);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('93910000-0000-0000-0000-000000000001', 'training-scope-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000002', 'training-scope-bodmin-line-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000003', 'training-scope-bodmin-site-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000004', 'training-scope-exeter-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000005', 'training-scope-null-unit-op@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000006', 'training-scope-bodmin-packer@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000007', 'training-scope-bodmin-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93910000-0000-0000-0000-000000000008', 'training-scope-outsider@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table training_scope_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on training_scope_ids to authenticated;

create temporary table training_scope_ids_payload (
  key text primary key,
  payload jsonb
) on commit drop;

grant select, insert on training_scope_ids_payload to authenticated;

insert into training_scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation('93910000-0000-0000-0000-000000000001', 'training-scope-org', 'Training-Scope Organisation')
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('93920000-0000-0000-0000-000000000001', '93910000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000002', '93910000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000003', '93910000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000004', '93910000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000005', '93910000-0000-0000-0000-000000000005', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000006', '93910000-0000-0000-0000-000000000006', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000007', '93910000-0000-0000-0000-000000000007', statement_timestamp(), statement_timestamp()),
  ('93920000-0000-0000-0000-000000000008', '93910000-0000-0000-0000-000000000008', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (organisation_id, user_id, display_name, status, activated_at)
select (select id from training_scope_ids where key = 'organisation'), members.user_id::uuid, members.display_name, 'active', statement_timestamp()
from (values
  ('93910000-0000-0000-0000-000000000002', 'A Bodmin Line Operator'),
  ('93910000-0000-0000-0000-000000000003', 'B Bodmin Site Operator'),
  ('93910000-0000-0000-0000-000000000004', 'C Exeter Operator'),
  ('93910000-0000-0000-0000-000000000005', 'D Null Unit Operator'),
  ('93910000-0000-0000-0000-000000000006', 'E Bodmin Packer'),
  ('93910000-0000-0000-0000-000000000007', 'F Bodmin Manager'),
  ('93910000-0000-0000-0000-000000000008', 'G Outsider')
) as members(user_id, display_name);

update public.organisation_memberships
set display_name = 'H Owner'
where organisation_id = (select id from training_scope_ids where key = 'organisation')
  and user_id = '93910000-0000-0000-0000-000000000001';

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '93910000-0000-0000-0000-000000000002',
  '93910000-0000-0000-0000-000000000003',
  '93910000-0000-0000-0000-000000000004',
  '93910000-0000-0000-0000-000000000005',
  '93910000-0000-0000-0000-000000000006',
  '93910000-0000-0000-0000-000000000007',
  '93910000-0000-0000-0000-000000000008'
);

insert into training_scope_ids (key, id)
select mapping.key, membership.id
from (values
  ('owner', '93910000-0000-0000-0000-000000000001'),
  ('bodmin_line_op', '93910000-0000-0000-0000-000000000002'),
  ('bodmin_site_op', '93910000-0000-0000-0000-000000000003'),
  ('exeter_op', '93910000-0000-0000-0000-000000000004'),
  ('null_unit_op', '93910000-0000-0000-0000-000000000005'),
  ('bodmin_packer', '93910000-0000-0000-0000-000000000006'),
  ('bodmin_manager', '93910000-0000-0000-0000-000000000007'),
  ('outsider', '93910000-0000-0000-0000-000000000008')
) as mapping(key, user_id)
join public.organisation_memberships membership
  on membership.organisation_id = (select id from training_scope_ids where key = 'organisation')
 and membership.user_id = mapping.user_id::uuid;

insert into training_scope_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from training_scope_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93910000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93920000-0000-0000-0000-000000000001","email":"training-scope-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from training_scope_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into training_scope_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from training_scope_ids where key = 'organisation'), null, 'bodmin', 'Bodmin', 'site'
);

insert into training_scope_ids (key, id)
select 'bodmin_line', public.create_organisation_unit(
  (select id from training_scope_ids where key = 'organisation'),
  (select id from training_scope_ids where key = 'bodmin_site'),
  'bodmin-line-3', 'Bodmin Line 3', 'department'
);

insert into training_scope_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from training_scope_ids where key = 'organisation'), null, 'exeter', 'Exeter', 'site'
);

insert into training_scope_ids (key, id)
select 'jf_operator', public.create_job_function('Operator', 'operator-scope');
insert into training_scope_ids (key, id)
select 'jf_packer', public.create_job_function('Packer', 'packer-scope');
insert into training_scope_ids (key, id)
select 'jf_supervisor', public.create_job_function('Supervisor', 'supervisor-scope');

-- Primary placements. null_unit_op has a job function but no unit;
-- owner and outsider have no assignment at all.
select public.assign_membership_job_function(
  (select id from training_scope_ids where key = placement.membership_key),
  (select id from training_scope_ids where key = placement.job_function_key),
  true,
  (select id from training_scope_ids where key = placement.unit_key)
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
  (select id from training_scope_ids where key = 'organisation'),
  (select id from training_scope_ids where key = 'null_unit_op'),
  (select id from training_scope_ids where key = 'jf_operator'),
  null,
  true,
  'Operator',
  'operator-scope',
  (select membership_row.id
   from public.organisation_memberships membership_row
   where membership_row.organisation_id = (select id from training_scope_ids where key = 'organisation')
     and membership_row.user_id = '93910000-0000-0000-0000-000000000001')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93910000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93920000-0000-0000-0000-000000000001","email":"training-scope-owner@example.test"}',
  true
);
set local role authenticated;
select ok(public.switch_organisation((select id from training_scope_ids where key = 'organisation')), 're-select organisation after null-unit placement');

select ok(
  public.grant_role_version(
    (select id from training_scope_ids where key = 'organisation'),
    (select id from training_scope_ids where key = 'bodmin_manager'),
    (select id from training_scope_ids where key = 'manager_role_version'),
    'unit_subtree',
    (select id from training_scope_ids where key = 'bodmin_site')
  ) is not null,
  'Bodmin site manager granted Manager at unit_subtree(Bodmin)'
);

insert into training_scope_ids (key, id)
select course_def.key, public.create_training_course_draft(course_def.name, course_def.code)
from (values
  ('c_all', 'Site induction', 'site-induction'),
  ('c_op', 'Oven safety', 'oven-safety'),
  ('c_bod', 'Bodmin allergen awareness', 'bodmin-allergen'),
  ('c_pack', 'Case packer basics', 'case-packer'),
  ('c_old', 'Retired legacy course', 'legacy-course'),
  ('c_new', 'New hygiene standard', 'new-hygiene')
) as course_def(key, name, code);

insert into training_scope_ids (key, id)
select 'curriculum', public.create_training_curriculum_draft('Scope Curriculum', 'scope-curriculum');
insert into training_scope_ids (key, id)
select 'curriculum_v1', version_row.id
from public.training_curriculum_versions version_row
where version_row.curriculum_id = (select id from training_scope_ids where key = 'curriculum') and version_row.version_number = 1;

-- v1 rows: (course, job function, unit, all members, mandatory, validity override)
--   c_all  all members, org-wide, mandatory
--   c_op   operator org-wide mandatory 365 | Bodmin mandatory 180 (tighten) | Exeter not mandatory (relax)
--   c_bod  all members, Bodmin subtree only
--   c_pack packer org-wide
--   c_old  all members (dropped in v2)
insert into training_scope_ids (key, id)
select requirement_def.key, public.add_training_requirement(
  (select id from training_scope_ids where key = 'curriculum_v1'),
  (select id from training_scope_ids where key = requirement_def.course_key),
  (select id from training_scope_ids where key = requirement_def.job_function_key),
  (select id from training_scope_ids where key = requirement_def.unit_key),
  requirement_def.all_members,
  requirement_def.mandatory,
  null,
  requirement_def.validity_days
)
from (values
  ('t_all', 'c_all', null, null, true, true, null::integer),
  ('t_op_org', 'c_op', 'jf_operator', null, false, true, 365),
  ('t_op_bodmin', 'c_op', 'jf_operator', 'bodmin_site', false, true, 180),
  ('t_op_exeter', 'c_op', 'jf_operator', 'exeter_site', false, false, null),
  ('t_bod', 'c_bod', null, 'bodmin_site', true, true, null),
  ('t_pack', 'c_pack', 'jf_packer', null, false, true, null),
  ('t_old', 'c_old', null, null, true, true, null)
) as requirement_def(key, course_key, job_function_key, unit_key, all_members, mandatory, validity_days);

select ok(public.publish_training_curriculum_version((select id from training_scope_ids where key = 'curriculum_v1')), 'publish curriculum v1');

insert into training_scope_ids_payload (key, payload)
values ('owner_v1', public.get_training_matrix(1, 100));

select is(((select payload from training_scope_ids_payload where key = 'owner_v1') ->> 'curriculum_version_id')::uuid, (select id from training_scope_ids where key = 'curriculum_v1'),
  'before successor: matrix uses v1');

insert into training_scope_ids (key, id)
select 'curriculum_v2', public.create_training_curriculum_successor_version((select id from training_scope_ids where key = 'curriculum'));

select ok(
  public.remove_training_requirement((
    select requirement_row.id from public.training_requirements requirement_row
    where requirement_row.curriculum_version_id = (select id from training_scope_ids where key = 'curriculum_v2')
      and requirement_row.course_id = (select id from training_scope_ids where key = 'c_old')
  )),
  'v2 draft drops the legacy course'
);
select ok(
  public.add_training_requirement((select id from training_scope_ids where key = 'curriculum_v2'), (select id from training_scope_ids where key = 'c_new'), null, null, true, true) is not null,
  'v2 draft adds the new course for all members'
);
select ok(public.publish_training_curriculum_version((select id from training_scope_ids where key = 'curriculum_v2')), 'publish curriculum v2');

-- 1. Latest curriculum ------------------------------------------------------

insert into training_scope_ids_payload (key, payload)
values ('owner', public.get_training_matrix(1, 100));

select is(((select payload from training_scope_ids_payload where key = 'owner') ->> 'curriculum_version_id')::uuid, (select id from training_scope_ids where key = 'curriculum_v2'),
  'matrix resolves the latest published curriculum version (v2)');
select is(
  (select array_agg((course ->> 'id')::uuid order by course ->> 'name') from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'courses') course),
  array[(select id from training_scope_ids where key = 'c_bod'), (select id from training_scope_ids where key = 'c_pack'), (select id from training_scope_ids where key = 'c_new'), (select id from training_scope_ids where key = 'c_op'), (select id from training_scope_ids where key = 'c_all')],
  'columns are exactly the v2 courses required on the page (legacy v1 course gone)'
);

-- 2. Applicability: audience x unit subtree ---------------------------------

select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'null_unit_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_op')), true, 'null unit: org-wide operator course applies');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'null_unit_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_bod')), null, 'null unit: Bodmin-only course does not apply');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_line_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_bod')), true, 'child unit (Bodmin Line 3) receives the Bodmin course');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_site_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_bod')), true, 'site unit itself receives the Bodmin course');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'exeter_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_bod')), null, 'sibling site (Exeter) does not receive the Bodmin course');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_packer') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_op')), null, 'wrong job function: operator course not required for a packer');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_line_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_pack')), null, 'wrong job function: packer course not required for an operator');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_packer') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_pack')), true, 'packer course required for the packer');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'outsider') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_all')), true, 'all-members org-wide course applies even with no assignment');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'owner') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_new')), true, 'new v2 all-members course applies to the owner');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'exeter_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_op')), false,
  'relax: Exeter non-mandatory row overrides the mandatory org-wide row (most specific wins)');
select is((select (cell ->> 'mandatory')::boolean from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell where (cell ->> 'membership_id')::uuid = (select id from training_scope_ids where key = 'bodmin_line_op') and (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_op')), true, 'tighten: Bodmin row keeps the course mandatory');
-- Resolver is revoked from PUBLIC at #392 head 962e8a2c: call it as the table owner.
reset role;
select is(
  (private.resolve_effective_training_requirement(
    (select id from training_scope_ids where key = 'organisation'), (select id from training_scope_ids where key = 'curriculum_v2'), (select id from training_scope_ids where key = 'c_op'), (select id from training_scope_ids where key = 'jf_operator'), (select id from training_scope_ids where key = 'bodmin_line')
  )).validity_days_override,
  180,
  'tighten: closest ancestor (Bodmin) validity 180 wins over org-wide 365'
);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from jsonb_array_elements((select payload from training_scope_ids_payload where key = 'owner') -> 'requirements') cell
    where (cell ->> 'course_id')::uuid = (select id from training_scope_ids where key = 'c_old')
  ),
  0,
  'no cell references the course only present in superseded v1'
);

-- 3. Compliance summary: null vs site unit (owner) --------------------------
-- No completions recorded, so outstanding_required = applicable mandatory cells.
-- Whole org 24 = c_all 8 + c_new 8 + c_op 3 (Bodmin x2, null unit) + c_bod 4 + c_pack 1.
-- Bodmin 15 = 4 + 4 + 2 + 4 + 1.  Bodmin Line 3 = 4.  Exeter = 2 (c_op relaxed).

insert into training_scope_ids_payload (key, payload)
values
  ('owner_comp_all', public.get_training_compliance_summary()),
  ('owner_comp_bodmin', public.get_training_compliance_summary((select id from training_scope_ids where key = 'bodmin_site'))),
  ('owner_comp_line', public.get_training_compliance_summary((select id from training_scope_ids where key = 'bodmin_line'))),
  ('owner_comp_exeter', public.get_training_compliance_summary((select id from training_scope_ids where key = 'exeter_site')));

select is(((select payload from training_scope_ids_payload where key = 'owner_comp_all') ->> 'outstanding_required')::integer, 24, 'compliance(null): whole organisation, null-unit people included');
select is(((select payload from training_scope_ids_payload where key = 'owner_comp_bodmin') ->> 'outstanding_required')::integer, 15, 'compliance(Bodmin): only the Bodmin subtree is counted');
select is(((select payload from training_scope_ids_payload where key = 'owner_comp_line') ->> 'outstanding_required')::integer, 4, 'compliance(Bodmin Line 3): child subtree only');
select is(((select payload from training_scope_ids_payload where key = 'owner_comp_exeter') ->> 'outstanding_required')::integer, 2, 'compliance(Exeter): relaxed operator course not counted');
select is(((select payload from training_scope_ids_payload where key = 'owner_comp_bodmin') ->> 'compliance_percent')::numeric, 0.0::numeric,
  'compliance percent is 0 with no completions');

-- 4. Unique index -----------------------------------------------------------

reset role;
select ok(
  exists (
    select 1
    from pg_catalog.pg_index index_row
    join pg_catalog.pg_class index_class on index_class.oid = index_row.indexrelid
    where index_class.relname = 'training_requirements_scope_unique_idx'
      and index_row.indisunique
      and index_row.indnullsnotdistinct
      and index_row.indrelid = 'public.training_requirements'::regclass
  ),
  'training_requirements_scope_unique_idx is UNIQUE NULLS NOT DISTINCT'
);
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93910000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93920000-0000-0000-0000-000000000001","email":"training-scope-owner@example.test"}',
  true
);
set local role authenticated;

insert into training_scope_ids (key, id)
select 'curriculum_v3', public.create_training_curriculum_successor_version((select id from training_scope_ids where key = 'curriculum'));
select throws_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, null, null, true, true)',
    (select id from training_scope_ids where key = 'curriculum_v3'), (select id from training_scope_ids where key = 'c_all')
  ),
  '23505',
  null,
  'duplicate org-wide all-members row (job function NULL, unit NULL) is rejected'
);
select lives_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, null, %L::uuid, true, true)',
    (select id from training_scope_ids where key = 'curriculum_v3'), (select id from training_scope_ids where key = 'c_all'), (select id from training_scope_ids where key = 'exeter_site')
  ),
  'same course scoped to a site is a distinct key'
);
select throws_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, %L::uuid, %L::uuid, false, false)',
    (select id from training_scope_ids where key = 'curriculum_v3'), (select id from training_scope_ids where key = 'c_op'), (select id from training_scope_ids where key = 'jf_operator'), (select id from training_scope_ids where key = 'bodmin_site')
  ),
  '23505',
  null,
  'duplicate Bodmin operator row is rejected even with different mandatory flag'
);

-- 5. Site manager: scoping and 42501 across sites --------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93910000-0000-0000-0000-000000000007","role":"authenticated","session_id":"93920000-0000-0000-0000-000000000007","email":"training-scope-bodmin-manager@example.test"}',
  true
);
set local role authenticated;

select ok(public.switch_organisation((select id from training_scope_ids where key = 'organisation')), 'Bodmin manager selects organisation');

insert into training_scope_ids_payload (key, payload)
values
  ('manager_matrix', public.get_training_matrix(1, 100)),
  ('manager_comp_bodmin', public.get_training_compliance_summary((select id from training_scope_ids where key = 'bodmin_site'))),
  ('manager_comp_line', public.get_training_compliance_summary((select id from training_scope_ids where key = 'bodmin_line'))),
  ('manager_comp_null', public.get_training_compliance_summary());

select is(((select payload from training_scope_ids_payload where key = 'manager_matrix') ->> 'total_people')::integer, 4,
  'Bodmin manager training matrix lists only the 4 Bodmin-subtree people');
select is(((select payload from training_scope_ids_payload where key = 'manager_comp_bodmin') ->> 'outstanding_required')::integer, 15, 'Bodmin manager: compliance(Bodmin) allowed and scoped');
select is(((select payload from training_scope_ids_payload where key = 'manager_comp_line') ->> 'outstanding_required')::integer, 4, 'Bodmin manager: compliance(child unit) allowed');
select throws_ok(
  format('select public.get_training_compliance_summary(%L::uuid)', (select id from training_scope_ids where key = 'exeter_site')),
  '42501',
  'training compliance summary is not authorised for this unit',
  'Bodmin manager cannot read Exeter compliance'
);
select throws_ok(
  format('select public.get_training_matrix(1, 50, %L::uuid)', (select id from training_scope_ids where key = 'exeter_site')),
  '42501',
  'training matrix is not authorised for this unit',
  'Bodmin manager cannot widen the training matrix to Exeter'
);
select todo('Decision for SENTINEL/Przem: compliance(null) for a unit_subtree manager is org-wide today', 1);
select is(((select payload from training_scope_ids_payload where key = 'manager_comp_null') ->> 'outstanding_required')::integer, 15,
  'compliance(null) for a site manager is limited to their subtree (or should fail closed)');

-- 6. No grants: 42501 on every new/changed read ------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93910000-0000-0000-0000-000000000008","role":"authenticated","session_id":"93920000-0000-0000-0000-000000000008","email":"training-scope-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(public.switch_organisation((select id from training_scope_ids where key = 'organisation')), 'outsider (no grants) selects organisation');
select throws_ok('select public.get_training_matrix()', '42501', 'training matrix is not authorised',
  'member without training.read gets 42501 from get_training_matrix');
select throws_ok('select public.get_training_compliance_summary()', '42501', 'training compliance summary is not authorised',
  'member without training.read gets 42501 from get_training_compliance_summary');

reset role;
select ok(
  not pg_catalog.has_function_privilege('anon', 'public.get_training_matrix(integer, integer, uuid)', 'execute'),
  'anon cannot execute get_training_matrix'
);
select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.get_training_matrix(integer, integer, uuid)', 'execute'),
  'authenticated can execute get_training_matrix'
);

select * from finish();
rollback;
