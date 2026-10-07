begin;

select plan(29);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.add_skill_proficiency_level(uuid,integer,text,text,text,text)'::regprocedure
  ) like '%for update%',
  'add proficiency level locks the draft scale version'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.add_skill_requirement(uuid,uuid,uuid,uuid,uuid,uuid,boolean,text,text)'::regprocedure
  ) like '%for update%',
  'add requirement locks the draft capability set version'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.publish_skill_proficiency_scale_version(uuid)'::regprocedure
  ) like '%for update%'
  and pg_catalog.pg_get_functiondef(
    'private.publish_skill_proficiency_scale_version(uuid)'::regprocedure
  ) like '%at least two levels%',
  'scale publish locks the draft and requires two levels'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.publish_skill_capability_set_version(uuid)'::regprocedure
  ) like '%for update%'
  and pg_catalog.pg_get_functiondef(
    'private.publish_skill_capability_set_version(uuid)'::regprocedure
  ) like '%assert_skill_requirement_targets%',
  'standard publish locks the draft and revalidates requirements'
);

select is(
  (
    select cfg
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proconfig) cfg
    where n.nspname = 'private'
      and p.proname = 'add_skill_proficiency_level'
      and cfg like 'search_path=%'
  ),
  'search_path=""',
  'add proficiency level keeps an empty search_path'
);

select is(
  (
    select role_row.rolname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles role_row on role_row.oid = p.proowner
    where n.nspname = 'private'
      and p.proname = 'add_skill_requirement'
  ),
  'lean_hub_private_owner',
  'requirement authoring stays owned by the private owner'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a6620000-0000-0000-0000-000000000001',
  'skills-integrity-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table skills_integrity_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on skills_integrity_ids to authenticated;

insert into skills_integrity_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a6620000-0000-0000-0000-000000000001',
    'skills-integrity',
    'Skills Integrity'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a6630000-0000-0000-0000-000000000001',
  'a6620000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a6620000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a6630000-0000-0000-0000-000000000001","email":"skills-integrity-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from skills_integrity_ids where key = 'organisation')),
  'owner selects the integrity organisation'
);

insert into skills_integrity_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Operational Proficiency');

insert into skills_integrity_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_integrity_ids where key = 'scale')
  and version_row.version_number = 1;

select throws_ok(
  $$
    select public.publish_skill_proficiency_scale_version(
      (select id from skills_integrity_ids where key = 'scale_version')
    )
  $$,
  '22023',
  'proficiency scale needs at least two levels',
  'empty scale cannot publish'
);

select is(
  (
    select version_row.status
    from public.skill_proficiency_scale_versions version_row
    where version_row.id = (select id from skills_integrity_ids where key = 'scale_version')
  ),
  'draft',
  'failed empty publish leaves the scale draft'
);

select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'scale_version'),
  1,
  'Awareness'
);

select throws_ok(
  $$
    select public.publish_skill_proficiency_scale_version(
      (select id from skills_integrity_ids where key = 'scale_version')
    )
  $$,
  '22023',
  'proficiency scale needs at least two levels',
  'one-level scale cannot publish'
);

select is(
  (
    select version_row.status
    from public.skill_proficiency_scale_versions version_row
    where version_row.id = (select id from skills_integrity_ids where key = 'scale_version')
  ),
  'draft',
  'failed one-level publish leaves the scale draft'
);

select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'scale_version'),
  2,
  'Competent'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from skills_integrity_ids where key = 'scale_version')
  ),
  'valid draft scale publishes'
);

select throws_ok(
  $$
    select public.add_skill_proficiency_level(
      (select id from skills_integrity_ids where key = 'scale_version'),
      3,
      'Advanced'
    )
  $$,
  'P0002',
  'draft scale version not found',
  'published scale rejects add_skill_proficiency_level'
);

select is(
  (
    select count(*)::integer
    from public.skill_proficiency_levels level_row
    where level_row.scale_version_id = (select id from skills_integrity_ids where key = 'scale_version')
  ),
  2,
  'published scale level count stays unchanged'
);

insert into skills_integrity_ids (key, id)
select 'archive_scale', public.create_skill_proficiency_scale_draft('Archive Probe');

insert into skills_integrity_ids (key, id)
select 'archive_scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_integrity_ids where key = 'archive_scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'archive_scale_version'),
  1,
  'Awareness'
);
select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'archive_scale_version'),
  2,
  'Competent'
);
select public.publish_skill_proficiency_scale_version(
  (select id from skills_integrity_ids where key = 'archive_scale_version')
);

reset role;

update public.skill_proficiency_scale_versions
set status = 'archived',
    archived_at = statement_timestamp()
where id = (select id from skills_integrity_ids where key = 'archive_scale_version');

set local role authenticated;

select throws_ok(
  $$
    select public.add_skill_proficiency_level(
      (select id from skills_integrity_ids where key = 'archive_scale_version'),
      3,
      'Extra'
    )
  $$,
  'P0002',
  'draft scale version not found',
  'archived scale rejects add_skill_proficiency_level'
);

insert into skills_integrity_ids (key, id)
select 'draft_scale', public.create_skill_proficiency_scale_draft('Draft Probe');

insert into skills_integrity_ids (key, id)
select 'draft_scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_integrity_ids where key = 'draft_scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'draft_scale_version'),
  1,
  'Awareness'
);

insert into skills_integrity_ids (key, id)
select 'draft_level', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skills_integrity_ids where key = 'draft_scale_version')
  and level_row.order_value = 1;

insert into skills_integrity_ids (key, id)
select 'other_scale', public.create_skill_proficiency_scale_draft('Other Scale');

insert into skills_integrity_ids (key, id)
select 'other_scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_integrity_ids where key = 'other_scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'other_scale_version'),
  1,
  'Aware'
);
select public.add_skill_proficiency_level(
  (select id from skills_integrity_ids where key = 'other_scale_version'),
  2,
  'Capable'
);
select public.publish_skill_proficiency_scale_version(
  (select id from skills_integrity_ids where key = 'other_scale_version')
);

insert into skills_integrity_ids (key, id)
select 'other_level', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skills_integrity_ids where key = 'other_scale_version')
  and level_row.order_value = 2;

insert into skills_integrity_ids (key, id)
select 'published_level', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skills_integrity_ids where key = 'scale_version')
  and level_row.order_value = 2;

insert into skills_integrity_ids (key, id)
select 'job_function', public.create_job_function('Production Operator', 'production-operator');

insert into skills_integrity_ids (key, id)
select 'inactive_job_function', public.create_job_function('Retired Operator', 'retired-operator');

select public.deactivate_job_function(
  (select id from skills_integrity_ids where key = 'inactive_job_function')
);

insert into skills_integrity_ids (key, id)
select 'skill', public.create_skill('Machine Setup', 'machine-setup');

insert into skills_integrity_ids (key, id)
select 'inactive_skill', public.create_skill('Obsolete Setup', 'obsolete-setup');

insert into skills_integrity_ids (key, id)
select 'retired_unit', public.create_organisation_unit(
  (select id from skills_integrity_ids where key = 'organisation'),
  null,
  'retired-site',
  'Retired Site',
  'site'
);

reset role;

update public.skills
set status = 'deactivated',
    deactivated_at = statement_timestamp()
where id = (select id from skills_integrity_ids where key = 'inactive_skill');

update public.organisation_units
set status = 'retired',
    retired_at = statement_timestamp(),
    status_reason = 'Skills authoring integrity probe'
where id = (select id from skills_integrity_ids where key = 'retired_unit');

set local role authenticated;

insert into skills_integrity_ids (key, id)
select 'empty_standard', public.create_skill_capability_set_draft(
  'Empty Standard',
  'empty-standard'
);

insert into skills_integrity_ids (key, id)
select 'empty_standard_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skills_integrity_ids where key = 'empty_standard')
  and version_row.version_number = 1;

select throws_ok(
  $$
    select public.publish_skill_capability_set_version(
      (select id from skills_integrity_ids where key = 'empty_standard_version')
    )
  $$,
  '22023',
  'skills standard needs at least one requirement',
  'empty capability set cannot publish'
);

select is(
  (
    select version_row.status
    from public.skill_capability_set_versions version_row
    where version_row.id = (select id from skills_integrity_ids where key = 'empty_standard_version')
  ),
  'draft',
  'failed empty publish leaves the skills standard draft'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'draft_scale_version'),
      (select id from skills_integrity_ids where key = 'draft_level')
    )
  $$,
  '22023',
  'proficiency scale version is not published',
  'requirement against a draft scale is rejected'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'archive_scale_version'),
      (
        select level_row.id
        from public.skill_proficiency_levels level_row
        where level_row.scale_version_id = (select id from skills_integrity_ids where key = 'archive_scale_version')
          and level_row.order_value = 2
      )
    )
  $$,
  '22023',
  'proficiency scale version is not published',
  'requirement against an archived scale is rejected'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'inactive_skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'published_level')
    )
  $$,
  '22023',
  'skill is not active',
  'inactive skill is rejected'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'inactive_job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'published_level')
    )
  $$,
  '22023',
  'job function is not active',
  'inactive job function is rejected'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'published_level'),
      (select id from skills_integrity_ids where key = 'retired_unit')
    )
  $$,
  '22023',
  'organisational unit is not active',
  'inactive organisational unit is rejected'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'empty_standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'other_level')
    )
  $$,
  '22023',
  'target proficiency level is incompatible with scale version',
  'target level from another scale is rejected'
);

insert into skills_integrity_ids (key, id)
select 'stale_skill', public.create_skill('Stale Setup', 'stale-setup');

insert into skills_integrity_ids (key, id)
select 'stale_standard', public.create_skill_capability_set_draft(
  'Stale Standard',
  'stale-standard'
);

insert into skills_integrity_ids (key, id)
select 'stale_standard_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skills_integrity_ids where key = 'stale_standard')
  and version_row.version_number = 1;

select public.add_skill_requirement(
  (select id from skills_integrity_ids where key = 'stale_standard_version'),
  (select id from skills_integrity_ids where key = 'stale_skill'),
  (select id from skills_integrity_ids where key = 'job_function'),
  (select id from skills_integrity_ids where key = 'scale_version'),
  (select id from skills_integrity_ids where key = 'published_level')
);

reset role;

update public.skills
set status = 'deactivated',
    deactivated_at = statement_timestamp()
where id = (select id from skills_integrity_ids where key = 'stale_skill');

set local role authenticated;

select throws_ok(
  $$
    select public.publish_skill_capability_set_version(
      (select id from skills_integrity_ids where key = 'stale_standard_version')
    )
  $$,
  '22023',
  'skill is not active',
  'publish revalidates and rejects an inactive skill'
);

select is(
  (
    select version_row.status
    from public.skill_capability_set_versions version_row
    where version_row.id = (select id from skills_integrity_ids where key = 'stale_standard_version')
  ),
  'draft',
  'failed revalidation leaves the skills standard draft'
);

insert into skills_integrity_ids (key, id)
select 'standard', public.create_skill_capability_set_draft(
  'Production Operator Skills',
  'production-operator-skills'
);

insert into skills_integrity_ids (key, id)
select 'standard_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skills_integrity_ids where key = 'standard')
  and version_row.version_number = 1;

select ok(
  public.add_skill_requirement(
    (select id from skills_integrity_ids where key = 'standard_version'),
    (select id from skills_integrity_ids where key = 'skill'),
    (select id from skills_integrity_ids where key = 'job_function'),
    (select id from skills_integrity_ids where key = 'scale_version'),
    (select id from skills_integrity_ids where key = 'published_level')
  ) is not null,
  'valid draft accepts a requirement'
);

select ok(
  public.publish_skill_capability_set_version(
    (select id from skills_integrity_ids where key = 'standard_version')
  ),
  'valid skills standard publishes'
);

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'published_level')
    )
  $$,
  'P0002',
  'draft capability set version not found',
  'published capability set rejects add_skill_requirement'
);

reset role;

update public.skill_capability_set_versions
set status = 'archived',
    archived_at = statement_timestamp()
where id = (select id from skills_integrity_ids where key = 'standard_version');

set local role authenticated;

select throws_ok(
  $$
    select public.add_skill_requirement(
      (select id from skills_integrity_ids where key = 'standard_version'),
      (select id from skills_integrity_ids where key = 'skill'),
      (select id from skills_integrity_ids where key = 'job_function'),
      (select id from skills_integrity_ids where key = 'scale_version'),
      (select id from skills_integrity_ids where key = 'published_level')
    )
  $$,
  'P0002',
  'draft capability set version not found',
  'archived capability set rejects add_skill_requirement'
);

select * from finish();
rollback;
