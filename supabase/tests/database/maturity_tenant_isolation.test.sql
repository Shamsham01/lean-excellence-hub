begin;

select plan(18);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '85000000-0000-0000-0000-000000000001',
    'maturity-tenant-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '85000000-0000-0000-0000-000000000002',
    'maturity-tenant-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table maturity_tenant_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on maturity_tenant_ids to authenticated;

insert into maturity_tenant_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '85000000-0000-0000-0000-000000000001',
      'maturity-tenant-a',
      'Maturity Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '85000000-0000-0000-0000-000000000002',
      'maturity-tenant-b',
      'Maturity Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '86000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '86000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

-- Tenant B setup
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"86000000-0000-0000-0000-000000000002","email":"maturity-tenant-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_tenant_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

insert into maturity_tenant_ids (key, id)
select 'model_b', public.create_maturity_model_draft('Tenant B Framework');

insert into maturity_tenant_ids (key, id)
select 'model_version_b', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from maturity_tenant_ids where key = 'org_b')
  and model_version.model_id = (select id from maturity_tenant_ids where key = 'model_b')
  and model_version.version_number = 1;

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from maturity_tenant_ids where key = 'model_version_b')
  ),
  'tenant B adds maturity level'
);

insert into maturity_tenant_ids (key, id)
select 'pillar_b', public.add_maturity_pillar(
  (select id from maturity_tenant_ids where key = 'model_version_b'),
  'Tenant B Pillar',
  1,
  null,
  1,
  null,
  'Tenant B Pillar'
);

insert into maturity_tenant_ids (key, id)
select 'criterion_b', public.add_maturity_criterion(
  (select id from maturity_tenant_ids where key = 'pillar_b'),
  'Tenant B criterion',
  1
);

insert into maturity_tenant_ids (key, id)
select 'question_b', public.add_maturity_question(
  (select id from maturity_tenant_ids where key = 'model_version_b'),
  (select section_id from public.maturity_pillars
    where id = (select id from maturity_tenant_ids where key = 'pillar_b')),
  'score',
  'Tenant B question',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from maturity_tenant_ids where key = 'criterion_b'),
    (select id from maturity_tenant_ids where key = 'question_b')
  ),
  'tenant B links scored question'
);

select ok(
  public.publish_maturity_model_version((select id from maturity_tenant_ids where key = 'model_version_b')),
  'tenant B publishes framework'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''tenant-b-unit'', ''Tenant B Unit'', ''site'')',
    (select id from maturity_tenant_ids where key = 'org_b')
  ),
  'tenant B creates unit'
);

insert into maturity_tenant_ids (key, id)
select 'unit_b', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from maturity_tenant_ids where key = 'org_b')
  and organisation_unit.code = 'tenant-b-unit';

insert into maturity_tenant_ids (key, id)
select 'assessment_b', public.start_maturity_assessment(
  (select id from maturity_tenant_ids where key = 'model_version_b'),
  (select id from maturity_tenant_ids where key = 'unit_b'),
  'formal',
  'site'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from maturity_tenant_ids where key = 'assessment_b'),
    (select id from maturity_tenant_ids where key = 'question_b')
  ),
  'tenant B answers assessment'
);

select ok(
  public.submit_maturity_assessment((select id from maturity_tenant_ids where key = 'assessment_b')),
  'tenant B submits assessment'
);

reset role;

-- Tenant A adversarial checks
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"86000000-0000-0000-0000-000000000001","email":"maturity-tenant-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_tenant_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

select is(
  (
    select count(*)
    from public.maturity_models maturity_model
    where maturity_model.id = (select id from maturity_tenant_ids where key = 'model_b')
  ),
  0::bigint,
  'tenant A cannot read tenant B maturity models'
);

select is(
  (
    select count(*)
    from public.maturity_model_versions model_version
    where model_version.id = (select id from maturity_tenant_ids where key = 'model_version_b')
  ),
  0::bigint,
  'tenant A cannot read tenant B maturity model versions'
);

select is(
  (
    select count(*)
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from maturity_tenant_ids where key = 'assessment_b')
  ),
  0::bigint,
  'tenant A cannot read tenant B assessments'
);

select is(
  (
    select count(*)
    from public.maturity_official_results official_result
    join public.maturity_assessments assessment_row
      on assessment_row.organisation_id = official_result.organisation_id
     and assessment_row.id = official_result.assessment_id
    where assessment_row.id = (select id from maturity_tenant_ids where key = 'assessment_b')
  ),
  0::bigint,
  'tenant A cannot read tenant B official results'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''site'')',
    (select id from maturity_tenant_ids where key = 'model_version_b'),
    (select id from maturity_tenant_ids where key = 'unit_b')
  ),
  null,
  null,
  'tenant A cannot start assessment against tenant B unit and version'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from maturity_tenant_ids where key = 'assessment_b'),
    (select id from maturity_tenant_ids where key = 'question_b')
  ),
  '42501',
  null,
  'tenant A cannot answer tenant B assessment question'
);

select throws_ok(
  format(
    'select public.approve_maturity_assessment(%L::uuid)',
    (select id from maturity_tenant_ids where key = 'assessment_b')
  ),
  null,
  null,
  'tenant A cannot approve tenant B assessment'
);

select throws_ok(
  format(
    'select public.publish_official_maturity_result(%L::uuid)',
    (select id from maturity_tenant_ids where key = 'assessment_b')
  ),
  null,
  null,
  'tenant A cannot publish tenant B official result'
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    where question_row.id = (select id from maturity_tenant_ids where key = 'question_b')
  ),
  0::bigint,
  'tenant A cannot read tenant B template questions'
);

-- Positive control: tenant A can manage own maturity model
insert into maturity_tenant_ids (key, id)
select 'model_a', public.create_maturity_model_draft('Tenant A Framework');

select ok(
  exists (
    select 1
    from public.maturity_models maturity_model
    where maturity_model.id = (select id from maturity_tenant_ids where key = 'model_a')
      and maturity_model.display_name = 'Tenant A Framework'
  ),
  'tenant A can create and read own maturity model'
);

select * from finish();
rollback;
