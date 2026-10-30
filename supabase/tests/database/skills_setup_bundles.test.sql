begin;

select plan(45);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c7100000-0000-0000-0000-000000000001',
  'skills-setup-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c7100000-0000-0000-0000-000000000002',
  'skills-setup-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c7100000-0000-0000-0000-000000000003',
  'skills-setup-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c7110000-0000-0000-0000-000000000001',
  'c7100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c7110000-0000-0000-0000-000000000002',
  'c7100000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'c7110000-0000-0000-0000-000000000003',
  'c7100000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

create temporary table skills_setup_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on skills_setup_ids to authenticated;

create function pg_temp.skill_setup_definition(
  target_job_function_id uuid,
  target_skill_name text,
  target_skill_code text,
  target_scale_name text,
  target_second_level text,
  target_resolution text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'source', 'manual',
    'template_key', null,
    'template_version', null,
    'title', 'Oven capability',
    'applicability', 'organisation',
    'scale_resolution', target_resolution,
    'sample', false,
    'scale', jsonb_build_object(
      'name', target_scale_name,
      'description', 'Describes demonstrated ability.',
      'levels', jsonb_build_array(
        jsonb_build_object('order', 0, 'label', 'Aware', 'guidance', 'Can describe the risk.'),
        jsonb_build_object('order', 1, 'label', target_second_level, 'guidance', 'Can perform the task.')
      )
    ),
    'skills', jsonb_build_array(
      jsonb_build_object(
        'name', target_skill_name,
        'code', target_skill_code,
        'category', 'Process',
        'description', 'An observable ability.',
        'evidence_expectations', 'Observed demonstration. Training attendance is not enough.'
      )
    ),
    'standard', jsonb_build_object(
      'name', target_skill_name || ' requirements',
      'code', target_skill_code || '-requirements',
      'description', 'Role requirements for this draft.'
    ),
    'requirements', jsonb_build_array(
      jsonb_build_object(
        'skill_code', target_skill_code,
        'job_function_id', target_job_function_id,
        'level_label', target_second_level,
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'unresolved_roles', '[]'::jsonb
  )
$$;

grant execute on function pg_temp.skill_setup_definition(uuid, text, text, text, text, text)
  to authenticated;

create function pg_temp.skill_setup_scoped_definition(
  target_job_function_id uuid,
  target_skill_name text,
  target_skill_code text,
  target_scale_name text,
  target_applicability text,
  target_requirements jsonb,
  target_source text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'source', target_source,
    'template_key', case when target_source = 'manual' then null else target_source end,
    'template_version', case when target_source = 'manual' then null else '1' end,
    'title', target_skill_name,
    'applicability', target_applicability,
    'scale_resolution', 'create',
    'sample', false,
    'scale', jsonb_build_object(
      'name', target_scale_name,
      'description', 'Describes demonstrated ability.',
      'levels', jsonb_build_array(
        jsonb_build_object('order', 0, 'label', 'Aware', 'guidance', 'Can describe the risk.'),
        jsonb_build_object('order', 1, 'label', 'Competent', 'guidance', 'Can perform the task.')
      )
    ),
    'skills', jsonb_build_array(
      jsonb_build_object(
        'name', target_skill_name,
        'code', target_skill_code,
        'category', 'Process',
        'description', 'An observable ability.',
        'evidence_expectations', 'Observed demonstration. Training attendance is not enough.'
      )
    ),
    'standard', jsonb_build_object(
      'name', target_skill_name || ' requirements',
      'code', target_skill_code || '-requirements',
      'description', 'Role requirements for this draft.'
    ),
    'requirements', target_requirements,
    'unresolved_roles', '[]'::jsonb
  )
$$;

grant execute on function pg_temp.skill_setup_scoped_definition(
  uuid, text, text, text, text, jsonb, text
) to authenticated;

insert into skills_setup_ids (key, id)
values
(
  'organisation',
  private.provision_organisation(
    'c7100000-0000-0000-0000-000000000001',
    'skills-setup-a',
    'Skills Setup A'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'c7100000-0000-0000-0000-000000000003',
    'skills-setup-b',
    'Skills Setup B'
  )
);

reset role;

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from skills_setup_ids where key = 'organisation'),
  'c7100000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c7100000-0000-0000-0000-000000000002';

insert into skills_setup_ids (key, id)
select 'reader_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'c7100000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"c7100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c7110000-0000-0000-0000-000000000001","email":"skills-setup-owner@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from skills_setup_ids where key = 'organisation'));

insert into skills_setup_ids (key, id)
select 'job_function', public.create_job_function(
  'Oven Operator',
  'oven-operator',
  'Runs the oven.'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000099',
    '{"source":"not-a-source"}'::jsonb
  )$$,
  '22023',
  'module setup definition is invalid',
  'invalid setup definition is rejected'
);

select is(
  (select count(*) from public.skill_setup_bundles),
  0::bigint,
  'rejected creation leaves no bundle'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c7100000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c7110000-0000-0000-0000-000000000002","email":"skills-setup-reader@example.test"}',
  true
);
select public.switch_organisation((select id from skills_setup_ids where key = 'organisation'));

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000098',
    pg_temp.skill_setup_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Operate and monitor the oven',
      'operate-and-monitor-the-oven',
      'Setup test proficiency',
      'Competent',
      'create'
    )
  )$$,
  '42501',
  'skill setup draft is not authorised',
  'a member without both setup permissions cannot create a draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c7100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c7110000-0000-0000-0000-000000000001","email":"skills-setup-owner@example.test"}',
  true
);
select public.switch_organisation((select id from skills_setup_ids where key = 'organisation'));

insert into skills_setup_ids (key, id)
select 'existing_skill', public.create_skill(
  'Operate and monitor the oven',
  'operate-and-monitor-the-oven',
  'Process',
  'Run the oven to the standard.',
  'Observed start-up.'
);

insert into skills_setup_ids (key, id)
select 'reuse_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000001',
  pg_temp.skill_setup_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Operate and monitor the oven',
    'operate-and-monitor-the-oven',
    'Setup test proficiency',
    'Competent',
    'create'
  )
);

select is(
  public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000001',
    pg_temp.skill_setup_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Operate and monitor the oven',
      'operate-and-monitor-the-oven',
      'Setup test proficiency',
      'Competent',
      'create'
    )
  ),
  (select id from skills_setup_ids where key = 'reuse_bundle'),
  'repeating the same idempotency key returns the original bundle'
);

select is(
  (
    select count(*)
    from public.skill_setup_bundles
    where idempotency_key = 'c7120000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'a double-click does not create a second bundle'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000001',
    jsonb_set(
      pg_temp.skill_setup_definition(
        (select id from skills_setup_ids where key = 'job_function'),
        'Operate and monitor the oven',
        'operate-and-monitor-the-oven',
        'Setup test proficiency',
        'Competent',
        'create'
      ),
      '{title}',
      '"A different oven capability"'
    )
  )$$,
  '22023',
  'skill setup creation key does not match this content',
  'a draft creation key does not ignore changed content'
);

select is(
  (
    select count(*)
    from public.skills
    where organisation_id = (select id from skills_setup_ids where key = 'organisation')
      and lower(name) = 'operate and monitor the oven'
  ),
  1::bigint,
  'an existing skill is reused instead of duplicated'
);

select is(
  (
    select ownership
    from public.skill_setup_bundle_items
    where bundle_id = (select id from skills_setup_ids where key = 'reuse_bundle')
      and record_kind = 'skill'
  ),
  'reused',
  'the bundle records the existing skill as reused'
);

select is(
  (select count(*) from public.membership_skill_assessments),
  0::bigint,
  'creating a draft does not assess anyone'
);

select ok(
  (public.preview_skill_setup_bundle_discard(
    (select id from skills_setup_ids where key = 'reuse_bundle')
  ) -> 'retained')::text like '%already active%',
  'discard preview keeps an active reused skill'
);

select public.discard_skill_setup_bundle(
  (select id from skills_setup_ids where key = 'reuse_bundle')
);

select is(
  (
    select status
    from public.skills
    where id = (select id from skills_setup_ids where key = 'existing_skill')
  ),
  'active',
  'discarding a draft keeps the reused skill'
);

select is(
  (
    select count(*)
    from public.skill_proficiency_scales
    where organisation_id = (select id from skills_setup_ids where key = 'organisation')
      and name = 'Setup test proficiency'
  ),
  0::bigint,
  'discarding a draft removes the unused scale it created'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000001',
    pg_temp.skill_setup_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Operate and monitor the oven',
      'operate-and-monitor-the-oven',
      'Setup test proficiency',
      'Competent',
      'create'
    )
  )$$,
  '22023',
  'skill setup creation key is already finished',
  'a discarded creation key does not resume the old bundle'
);

insert into skills_setup_ids (key, id)
select 'after_discard_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000010',
  pg_temp.skill_setup_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Operate and monitor the oven',
    'operate-and-monitor-the-oven',
    'Setup test proficiency',
    'Competent',
    'create'
  )
);

select is(
  (
    select status
    from public.skill_setup_bundles
    where id = (select id from skills_setup_ids where key = 'after_discard_bundle')
  ),
  'draft',
  'a new creation key starts another setup after discard'
);

insert into skills_setup_ids (key, id)
select 'publish_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000002',
  pg_temp.skill_setup_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Complete the required quality checks',
    'complete-the-required-quality-checks',
    'Published setup proficiency',
    'Competent',
    'create'
  )
);

select throws_ok(
  format(
    $$select public.record_skill_validation(
      %L::uuid,
      (select id from public.skills where code = 'complete-the-required-quality-checks'),
      (select scale_version_id from public.skill_setup_bundles where id = %L::uuid),
      (
        select level_row.id
        from public.skill_proficiency_levels level_row
        where level_row.scale_version_id = (
          select scale_version_id from public.skill_setup_bundles where id = %L::uuid
        )
          and level_row.label = 'Competent'
      )
    )$$,
    (select id from public.organisation_memberships where user_id = 'c7100000-0000-0000-0000-000000000001'),
    (select id from skills_setup_ids where key = 'publish_bundle'),
    (select id from skills_setup_ids where key = 'publish_bundle')
  ),
  '22023',
  'draft skills cannot be assessed',
  'a draft skill cannot be assessed'
);

select ok(
  public.publish_skill_setup_bundle(
    (select id from skills_setup_ids where key = 'publish_bundle')
  ),
  'explicit publication succeeds'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000002',
    pg_temp.skill_setup_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Complete the required quality checks',
      'complete-the-required-quality-checks',
      'Published setup proficiency',
      'Competent',
      'create'
    )
  )$$,
  '22023',
  'skill setup creation key is already finished',
  'a published creation key does not resume the old bundle'
);

insert into skills_setup_ids (key, id)
select 'after_publish_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000011',
  pg_temp.skill_setup_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Release a product after the quality hold',
    'release-a-product-after-the-quality-hold',
    'After publication proficiency',
    'Competent',
    'create'
  )
);

select is(
  (
    select status
    from public.skill_setup_bundles
    where id = (select id from skills_setup_ids where key = 'after_publish_bundle')
  ),
  'draft',
  'a new creation key starts another setup after publication'
);

select is(
  (
    select status
    from public.skills
    where code = 'complete-the-required-quality-checks'
  ),
  'active',
  'publication makes the draft skill active'
);

select is(
  (
    select version_row.status
    from public.skill_capability_set_versions version_row
    join public.skill_setup_bundles bundle
      on bundle.capability_set_version_id = version_row.id
    where bundle.id = (select id from skills_setup_ids where key = 'publish_bundle')
  ),
  'published',
  'publication makes the requirements operational'
);

select is(
  (select count(*) from public.membership_skill_assessments),
  0::bigint,
  'publication does not mark anyone competent'
);

insert into skills_setup_ids (key, id)
select 'validation', public.record_skill_validation(
  (
    select id
    from public.organisation_memberships
    where user_id = 'c7100000-0000-0000-0000-000000000001'
  ),
  (select id from public.skills where code = 'complete-the-required-quality-checks'),
  (
    select scale_version_id
    from public.skill_setup_bundles
    where id = (select id from skills_setup_ids where key = 'publish_bundle')
  ),
  (
    select level_row.id
    from public.skill_proficiency_levels level_row
    where level_row.label = 'Competent'
      and level_row.scale_version_id = (
        select scale_version_id
        from public.skill_setup_bundles
        where id = (select id from skills_setup_ids where key = 'publish_bundle')
      )
  )
);

select throws_ok(
  $$select public.discard_skill_setup_bundle(
    (select id from skills_setup_ids where key = 'publish_bundle')
  )$$,
  '22023',
  'published setup bundles are kept',
  'a published bundle cannot be discarded'
);

select is(
  (select count(*) from public.membership_skill_assessments),
  1::bigint,
  'assessment history survives an attempted discard'
);

insert into skills_setup_ids (key, id)
select 'conflict_scale', public.create_skill_proficiency_scale_draft(
  'Conflicting proficiency',
  'A published scale with different levels.'
);

select public.add_skill_proficiency_level(
  (
    select id
    from public.skill_proficiency_scale_versions
    where scale_id = (select id from skills_setup_ids where key = 'conflict_scale')
  ),
  0,
  'Aware',
  null,
  null,
  'Can describe it.'
);

select public.add_skill_proficiency_level(
  (
    select id
    from public.skill_proficiency_scale_versions
    where scale_id = (select id from skills_setup_ids where key = 'conflict_scale')
  ),
  1,
  'Expert',
  null,
  null,
  'Can teach it.'
);

select public.publish_skill_proficiency_scale_version(
  (
    select id
    from public.skill_proficiency_scale_versions
    where scale_id = (select id from skills_setup_ids where key = 'conflict_scale')
  )
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000003',
    pg_temp.skill_setup_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Change over equipment using the standard method',
      'change-over-equipment',
      'Conflicting proficiency',
      'Competent',
      'create'
    )
  )$$,
  '22023',
  'existing proficiency scale differs',
  'a same-named scale with different levels is not overwritten'
);

select is(
  (
    select count(*)
    from public.skill_setup_bundles
    where idempotency_key = 'c7120000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'the conflicting create rolls back completely'
);

insert into skills_setup_ids (key, id)
select 'alongside_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000004',
  pg_temp.skill_setup_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Record process data accurately',
    'record-process-data-accurately',
    'Conflicting proficiency',
    'Competent',
    'create_alongside'
  )
);

select ok(
  exists (
    select 1
    from public.skill_proficiency_scales
    where name = 'Conflicting proficiency (setup draft)'
  ),
  'create alongside keeps the published scale and adds a separate draft'
);

select is(
  public.save_skill_setup_preparation(
    'manual',
    '',
    '{"step":"skills","scaleName":"Saved scale"}'::jsonb
  ) is not null,
  true,
  'setup choices can be saved'
);

select is(
  (
    select state ->> 'scaleName'
    from public.skill_setup_preparations
    where source = 'manual'
      and template_key = ''
  ),
  'Saved scale',
  'saved setup choices reload for the same member'
);

insert into skills_setup_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from skills_setup_ids where key = 'organisation'),
  null,
  'bodmin-bakery',
  'Bodmin Bakery',
  'site'
);

insert into skills_setup_ids (key, id)
select 'bodmin_packing', public.create_organisation_unit(
  (select id from skills_setup_ids where key = 'organisation'),
  (select id from skills_setup_ids where key = 'bodmin_site'),
  'bodmin-packing',
  'Bodmin Packing',
  'department'
);

insert into skills_setup_ids (key, id)
select 'bodmin_oven', public.create_organisation_unit(
  (select id from skills_setup_ids where key = 'organisation'),
  (select id from skills_setup_ids where key = 'bodmin_site'),
  'bodmin-oven',
  'Bodmin Oven',
  'department'
);

insert into skills_setup_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from skills_setup_ids where key = 'organisation'),
  null,
  'exeter-bakery',
  'Exeter Bakery',
  'site'
);

insert into skills_setup_ids (key, id)
select 'exeter_oven', public.create_organisation_unit(
  (select id from skills_setup_ids where key = 'organisation'),
  (select id from skills_setup_ids where key = 'exeter_site'),
  'exeter-oven',
  'Exeter Oven',
  'department'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000040',
    pg_temp.skill_setup_scoped_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Set the oven temperature',
      'set-the-oven-temperature',
      'Unit scope proficiency',
      'units',
      jsonb_build_array(
        jsonb_build_object(
          'skill_code', 'set-the-oven-temperature',
          'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
          'level_label', 'Competent',
          'organisational_unit_id', null,
          'mandatory', true,
          'evidence_requirement', 'Observed demonstration.',
          'notes', null
        )
      ),
      'manual'
    )
  )$$,
  '22023',
  'unit applicability requires an organisational unit',
  'unit applicability rejects a requirement with no unit'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000041',
    pg_temp.skill_setup_scoped_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Set the oven temperature',
      'set-the-oven-temperature',
      'Unit scope proficiency',
      'units',
      jsonb_build_array(
        jsonb_build_object(
          'skill_code', 'set-the-oven-temperature',
          'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
          'level_label', 'Competent',
          'organisational_unit_id', 'c7190000-0000-0000-0000-000000000099',
          'mandatory', true,
          'evidence_requirement', 'Observed demonstration.',
          'notes', null
        )
      ),
      'manual'
    )
  )$$,
  '22023',
  'organisational unit is not in this organisation',
  'unit applicability rejects an unknown unit'
);

insert into skills_setup_ids (key, id)
select 'unit_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000042',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Set the oven temperature',
    'set-the-oven-temperature',
    'Unit scope proficiency',
    'units',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'set-the-oven-temperature',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', (select id from skills_setup_ids where key = 'bodmin_packing'),
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      ),
      jsonb_build_object(
        'skill_code', 'set-the-oven-temperature',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', (select id from skills_setup_ids where key = 'bodmin_oven'),
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

select is(
  (
    select count(*)
    from public.skill_requirements requirement_row
    join public.skill_setup_bundles bundle
      on bundle.capability_set_version_id = requirement_row.capability_set_version_id
    where bundle.id = (select id from skills_setup_ids where key = 'unit_bundle')
  ),
  2::bigint,
  'one confirmed site stores a requirement for each selected unit'
);

select is(
  (
    select count(*)
    from public.skill_requirements requirement_row
    join public.skill_setup_bundles bundle
      on bundle.capability_set_version_id = requirement_row.capability_set_version_id
    where bundle.id = (select id from skills_setup_ids where key = 'unit_bundle')
      and requirement_row.organisational_unit_id = (
        select id from skills_setup_ids where key = 'exeter_oven'
      )
  ),
  0::bigint,
  'requirements for Bodmin do not include Exeter'
);

insert into skills_setup_ids (key, id)
select 'organisation_unit_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000043',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Clear the oven at the end of the run',
    'clear-the-oven-at-the-end-of-the-run',
    'Organisation scope proficiency',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'clear-the-oven-at-the-end-of-the-run',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', (select id from skills_setup_ids where key = 'bodmin_oven'),
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

select is(
  (
    select requirement_row.organisational_unit_id
    from public.skill_requirements requirement_row
    join public.skill_setup_bundles bundle
      on bundle.capability_set_version_id = requirement_row.capability_set_version_id
    where bundle.id = (
      select id from skills_setup_ids where key = 'organisation_unit_bundle'
    )
  ),
  null,
  'organisation-wide applicability stores a null unit'
);

insert into skills_setup_ids (key, id)
select 'quick_start_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000030',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Check ingredient weights',
    'check-ingredient-weights',
    'Quick start proficiency',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'check-ingredient-weights',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'quick_start'
  )
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000030',
    jsonb_set(
      pg_temp.skill_setup_scoped_definition(
        (select id from skills_setup_ids where key = 'job_function'),
        'Check ingredient weights',
        'check-ingredient-weights',
        'Quick start proficiency',
        'organisation',
        jsonb_build_array(
          jsonb_build_object(
            'skill_code', 'check-ingredient-weights',
            'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
            'level_label', 'Competent',
            'organisational_unit_id', null,
            'mandatory', true,
            'evidence_requirement', 'Observed demonstration.',
            'notes', null
          )
        ),
        'quick_start'
      ),
      '{title}',
      '"Changed quick start"'
    )
  )$$,
  '22023',
  'skill setup creation key does not match this content',
  'quick start does not ignore changed content for the same key'
);

select public.discard_skill_setup_bundle(
  (select id from skills_setup_ids where key = 'quick_start_bundle')
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000030',
    pg_temp.skill_setup_scoped_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Check ingredient weights',
      'check-ingredient-weights',
      'Quick start proficiency',
      'organisation',
      jsonb_build_array(
        jsonb_build_object(
          'skill_code', 'check-ingredient-weights',
          'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
          'level_label', 'Competent',
          'organisational_unit_id', null,
          'mandatory', true,
          'evidence_requirement', 'Observed demonstration.',
          'notes', null
        )
      ),
      'quick_start'
    )
  )$$,
  '22023',
  'skill setup creation key is already finished',
  'a discarded quick start key does not resume the old bundle'
);

insert into skills_setup_ids (key, id)
select 'leanai_bundle', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000031',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Record bake times',
    'record-bake-times',
    'LeanAI proficiency',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'record-bake-times',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'leanai'
  )
);

select ok(
  public.publish_skill_setup_bundle(
    (select id from skills_setup_ids where key = 'leanai_bundle')
  ),
  'a LeanAI draft can be published'
);

select throws_ok(
  $$select public.create_skill_setup_draft(
    'c7120000-0000-0000-0000-000000000031',
    pg_temp.skill_setup_scoped_definition(
      (select id from skills_setup_ids where key = 'job_function'),
      'Record bake times',
      'record-bake-times',
      'LeanAI proficiency',
      'organisation',
      jsonb_build_array(
        jsonb_build_object(
          'skill_code', 'record-bake-times',
          'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
          'level_label', 'Competent',
          'organisational_unit_id', null,
          'mandatory', true,
          'evidence_requirement', 'Observed demonstration.',
          'notes', null
        )
      ),
      'leanai'
    )
  )$$,
  '22023',
  'skill setup creation key is already finished',
  'a published LeanAI key does not resume the old bundle'
);

insert into skills_setup_ids (key, id)
select 'shared_creator', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000020',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Load the oven',
    'load-the-oven',
    'Shared draft scale A',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'load-the-oven',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

insert into skills_setup_ids (key, id)
select 'shared_reuser', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000021',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Load the oven',
    'load-the-oven',
    'Shared draft scale B',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'load-the-oven',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

select is(
  (
    select ownership
    from public.skill_setup_bundle_items
    where bundle_id = (select id from skills_setup_ids where key = 'shared_reuser')
      and record_kind = 'skill'
  ),
  'reused',
  'a second unpublished bundle reuses the draft skill'
);

select public.discard_skill_setup_bundle(
  (select id from skills_setup_ids where key = 'shared_creator')
);

select is(
  (
    select status
    from public.skills
    where code = 'load-the-oven'
  ),
  'draft',
  'discarding one bundle keeps a draft skill still used by another'
);

select public.discard_skill_setup_bundle(
  (select id from skills_setup_ids where key = 'shared_reuser')
);

select is(
  (
    select count(*)
    from public.skills
    where code = 'load-the-oven'
  ),
  0::bigint,
  'discarding the last unpublished bundle removes the draft skill'
);

insert into skills_setup_ids (key, id)
select 'shared_creator_again', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000022',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Load the oven',
    'load-the-oven',
    'Shared draft scale C',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'load-the-oven',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

insert into skills_setup_ids (key, id)
select 'shared_reuser_again', public.create_skill_setup_draft(
  'c7120000-0000-0000-0000-000000000023',
  pg_temp.skill_setup_scoped_definition(
    (select id from skills_setup_ids where key = 'job_function'),
    'Load the oven',
    'load-the-oven',
    'Shared draft scale D',
    'organisation',
    jsonb_build_array(
      jsonb_build_object(
        'skill_code', 'load-the-oven',
        'job_function_id', (select id from skills_setup_ids where key = 'job_function'),
        'level_label', 'Competent',
        'organisational_unit_id', null,
        'mandatory', true,
        'evidence_requirement', 'Observed demonstration.',
        'notes', null
      )
    ),
    'manual'
  )
);

select ok(
  public.publish_skill_setup_bundle(
    (select id from skills_setup_ids where key = 'shared_reuser_again')
  ),
  'publishing the reusing bundle activates the shared draft skill'
);

select is(
  (
    select status
    from public.skills
    where code = 'load-the-oven'
  ),
  'active',
  'the shared skill is active after the reusing bundle is published'
);

select public.discard_skill_setup_bundle(
  (select id from skills_setup_ids where key = 'shared_creator_again')
);

select is(
  (
    select status
    from public.skills
    where code = 'load-the-oven'
  ),
  'active',
  'discarding the other bundle keeps the skill after it is active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c7100000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c7110000-0000-0000-0000-000000000003","email":"skills-setup-other@example.test"}',
  true
);
select public.switch_organisation((select id from skills_setup_ids where key = 'other_organisation'));

select throws_ok(
  $$select public.publish_skill_setup_bundle(
    (select id from skills_setup_ids where key = 'publish_bundle')
  )$$,
  'P0002',
  'skill setup bundle was not found',
  'another organisation cannot publish this bundle'
);

select is(
  (
    select count(*)
    from public.skill_setup_bundles
  ),
  0::bigint,
  'setup bundles are not visible across organisations'
);

select * from finish();

rollback;
