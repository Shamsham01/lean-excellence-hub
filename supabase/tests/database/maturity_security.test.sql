begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '81000000-0000-0000-0000-000000000001',
  'maturity-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table maturity_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on maturity_ids to authenticated;

insert into maturity_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '81000000-0000-0000-0000-000000000001',
    'maturity-org',
    'Maturity Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '82000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"82000000-0000-0000-0000-000000000001","email":"maturity-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_ids where key = 'organisation')),
  'maturity owner selects organisation'
);

insert into maturity_ids (key, id)
select 'model', public.create_maturity_model_draft('Test Framework');

insert into maturity_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from maturity_ids where key = 'organisation')
  and model_version.model_id = (select id from maturity_ids where key = 'model')
  and model_version.version_number = 1;

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from maturity_ids where key = 'model_version')
  ),
  'can add maturity level to draft version'
);

insert into maturity_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from maturity_ids where key = 'model_version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

select throws_ok(
  format(
    'select public.publish_template_version(%L::uuid)',
    (select template_version_id from public.maturity_model_versions
      where id = (select id from maturity_ids where key = 'model_version'))
  ),
  '42501',
  'maturity assessment template publication must use maturity operations',
  'cannot publish maturity template via generic RPC'
);

select ok(
  public.publish_maturity_model_version((select id from maturity_ids where key = 'model_version')),
  'maturity model version publishes atomically'
);

select ok(
  exists (
    select 1
    from public.maturity_model_versions model_version
    join public.template_versions template_version
      on template_version.organisation_id = model_version.organisation_id
     and template_version.id = model_version.template_version_id
    where model_version.id = (select id from maturity_ids where key = 'model_version')
      and model_version.status = 'published'
      and template_version.status = 'published'
  ),
  'maturity and template versions stay synchronised after publish'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''test-unit'', ''Test Unit'', ''site'')',
    (select id from maturity_ids where key = 'organisation')
  ),
  'can create unit for assessment scope'
);

insert into maturity_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from maturity_ids where key = 'organisation')
  and organisation_unit.code = 'test-unit';

insert into maturity_ids (key, id)
select 'assessment', public.start_maturity_assessment(
  (select id from maturity_ids where key = 'model_version'),
  (select id from maturity_ids where key = 'unit'),
  'self'
);

select ok(
  (select status from public.maturity_assessments
    where id = (select id from maturity_ids where key = 'assessment')) = 'in_progress',
  'self assessment starts in progress'
);

reset role;

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key = 'maturity.read'
  ),
  'maturity.read permission exists'
);

select ok(
  exists (
    select 1
    from public.role_permissions role_permission
    join public.role_versions role_version
      on role_version.organisation_id = role_permission.organisation_id
     and role_version.id = role_permission.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_row.organisation_id = (select id from maturity_ids where key = 'organisation')
      and role_row.is_owner_role
      and role_permission.permission_key = 'maturity.read'
  ),
  'owner role upgraded with maturity.read'
);

select * from finish();
rollback;
