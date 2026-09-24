begin;

select plan(24);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    'curriculum-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    'curriculum-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table curriculum_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on curriculum_ids to authenticated;

insert into curriculum_ids (key, id)
values (
  'org_a',
  private.provision_organisation(
    '93000000-0000-0000-0000-000000000001',
    'curriculum-org-a',
    'Curriculum Organisation A'
  )
),
(
  'org_b',
  private.provision_organisation(
    '93000000-0000-0000-0000-000000000002',
    'curriculum-org-b',
    'Curriculum Organisation B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '93100000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '93100000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93100000-0000-0000-0000-000000000001","email":"curriculum-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from curriculum_ids where key = 'org_a')),
  'organisation A owner selects organisation'
);

insert into curriculum_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from curriculum_ids where key = 'org_a'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into curriculum_ids (key, id)
select 'unit_ops', public.create_organisation_unit(
  (select id from curriculum_ids where key = 'org_a'),
  (select id from curriculum_ids where key = 'unit_root'),
  'ops-dept',
  'Operations',
  'department'
);

insert into curriculum_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into curriculum_ids (key, id)
select 'course', public.create_training_course_draft('Lean Basic', 'lean-basic');

insert into curriculum_ids (key, id)
select 'curriculum', public.create_training_curriculum_draft(
  'Main Curriculum',
  'main-curriculum',
  'Who needs Lean Basic'
);

insert into curriculum_ids (key, id)
select 'curriculum_version', version_row.id
from public.training_curriculum_versions version_row
where version_row.curriculum_id = (select id from curriculum_ids where key = 'curriculum')
  and version_row.version_number = 1;

select ok(
  public.add_training_requirement(
    (select id from curriculum_ids where key = 'curriculum_version'),
    (select id from curriculum_ids where key = 'course'),
    null,
    null,
    true,
    true,
    30,
    180,
    7,
    'All members need Lean Basic'
  ) is not null,
  'add all-members requirement to draft'
);

insert into curriculum_ids (key, id)
select 'requirement_all', requirement_row.id
from public.training_requirements requirement_row
where requirement_row.curriculum_version_id = (
  select id from curriculum_ids where key = 'curriculum_version'
)
  and requirement_row.applies_to_all_members;

select ok(
  public.update_training_requirement(
    (select id from curriculum_ids where key = 'requirement_all'),
    (select id from curriculum_ids where key = 'course'),
    null,
    null,
    true,
    true,
    45,
    180,
    7,
    'Updated all-members note'
  ),
  'update draft all-members requirement'
);

select ok(
  public.add_training_requirement(
    (select id from curriculum_ids where key = 'curriculum_version'),
    (select id from curriculum_ids where key = 'course'),
    (select id from curriculum_ids where key = 'job_function'),
    null,
    false,
    true
  ) is not null,
  'add job-function requirement to draft'
);

select ok(
  public.add_training_requirement(
    (select id from curriculum_ids where key = 'curriculum_version'),
    (select id from curriculum_ids where key = 'course'),
    (select id from curriculum_ids where key = 'job_function'),
    (select id from curriculum_ids where key = 'unit_ops'),
    false,
    false,
    14
  ) is not null,
  'add job-function and unit requirement to draft'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.update_training_requirement(uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text)',
    'execute'
  ),
  'authenticated can execute update_training_requirement'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.remove_training_requirement(uuid)',
    'execute'
  ),
  'authenticated can execute remove_training_requirement'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_training_curriculum_successor_version(uuid)',
    'execute'
  ),
  'authenticated can execute create_training_curriculum_successor_version'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.update_training_requirement(uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text)',
    'execute'
  ),
  'anonymous cannot execute update_training_requirement'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.remove_training_requirement(uuid)',
    'execute'
  ),
  'anonymous cannot execute remove_training_requirement'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_training_curriculum_successor_version(uuid)',
    'execute'
  ),
  'anonymous cannot execute create_training_curriculum_successor_version'
);

select ok(
  public.publish_training_curriculum_version(
    (select id from curriculum_ids where key = 'curriculum_version')
  ),
  'publish curriculum version'
);

select ok(
  (
    public.get_training_compliance_summary() ->> 'outstanding_required'
  )::integer >= 1,
  'published all-members requirement feeds existing compliance calculation'
);

select throws_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, null, null, true)',
    (select id from curriculum_ids where key = 'curriculum_version'),
    (select id from curriculum_ids where key = 'course')
  ),
  'P0002',
  'draft curriculum version not found',
  'published curriculum cannot gain new requirements in place'
);

select throws_ok(
  format(
    'select public.update_training_requirement(%L::uuid, %L::uuid, null, null, true)',
    (select id from curriculum_ids where key = 'requirement_all'),
    (select id from curriculum_ids where key = 'course')
  ),
  'P0002',
  'draft curriculum version not found',
  'published requirement cannot be updated in place'
);

select throws_ok(
  format(
    'select public.remove_training_requirement(%L::uuid)',
    (select id from curriculum_ids where key = 'requirement_all')
  ),
  'P0002',
  'draft curriculum version not found',
  'published requirement cannot be removed in place'
);

insert into curriculum_ids (key, id)
select 'successor_version', public.create_training_curriculum_successor_version(
  (select id from curriculum_ids where key = 'curriculum')
);

select is(
  (
    select count(*)::integer
    from public.training_requirements requirement_row
    where requirement_row.curriculum_version_id = (
      select id from curriculum_ids where key = 'successor_version'
    )
  ),
  3,
  'successor draft copies published requirements'
);

insert into curriculum_ids (key, id)
select 'successor_requirement', requirement_row.id
from public.training_requirements requirement_row
where requirement_row.curriculum_version_id = (
  select id from curriculum_ids where key = 'successor_version'
)
  and requirement_row.applies_to_all_members
limit 1;

select ok(
  public.update_training_requirement(
    (select id from curriculum_ids where key = 'successor_requirement'),
    (select id from curriculum_ids where key = 'course'),
    null,
    null,
    true,
    true,
    60,
    null,
    0,
    'Successor edit'
  ),
  'successor draft requirement can be updated'
);

select ok(
  public.remove_training_requirement(
    (select id from curriculum_ids where key = 'successor_requirement')
  ),
  'successor draft requirement can be removed'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"93100000-0000-0000-0000-000000000002","email":"curriculum-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from curriculum_ids where key = 'org_b')),
  'organisation B owner selects organisation'
);

insert into curriculum_ids (key, id)
select 'course_b', public.create_training_course_draft('Org B Course', 'org-b-course');

insert into curriculum_ids (key, id)
select 'curriculum_b', public.create_training_curriculum_draft(
  'Org B Curriculum',
  'org-b-curriculum'
);

insert into curriculum_ids (key, id)
select 'curriculum_b_version', version_row.id
from public.training_curriculum_versions version_row
where version_row.curriculum_id = (select id from curriculum_ids where key = 'curriculum_b')
  and version_row.version_number = 1;

select throws_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, null, null, true)',
    (select id from curriculum_ids where key = 'curriculum_version'),
    (select id from curriculum_ids where key = 'course_b')
  ),
  'P0002',
  'draft curriculum version not found',
  'organisation B cannot add to organisation A curriculum version'
);

select throws_ok(
  format(
    'select public.add_training_requirement(%L::uuid, %L::uuid, null, null, true)',
    (select id from curriculum_ids where key = 'curriculum_b_version'),
    (select id from curriculum_ids where key = 'course')
  ),
  'P0002',
  'training course not found',
  'organisation B cannot attach organisation A course identifiers'
);

select throws_ok(
  format(
    'select public.update_training_requirement(%L::uuid, %L::uuid, null, null, true)',
    (select id from curriculum_ids where key = 'requirement_all'),
    (select id from curriculum_ids where key = 'course_b')
  ),
  'P0002',
  'training requirement not found',
  'organisation B cannot update organisation A requirements'
);

select throws_ok(
  format(
    'select public.create_training_curriculum_successor_version(%L::uuid)',
    (select id from curriculum_ids where key = 'curriculum')
  ),
  'P0002',
  'published curriculum version not found',
  'organisation B cannot create a successor for organisation A'
);

select * from finish();
rollback;
