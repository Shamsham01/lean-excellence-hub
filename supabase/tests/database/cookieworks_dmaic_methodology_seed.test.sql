begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'd1000000-0000-0000-0000-000000000001',
  'cw-dmaic-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table cw_dmaic_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on cw_dmaic_ids to authenticated;

insert into cw_dmaic_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd1000000-0000-0000-0000-000000000001',
    'cookieworks-manufacturing',
    'CookieWorks Manufacturing'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'd2000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select ok(
  exists (
    select 1
    from public.organisations organisation_row
    where organisation_row.id = (select id from cw_dmaic_ids where key = 'organisation')
      and organisation_row.code = 'cookieworks-manufacturing'
  ),
  'CookieWorks organisation code is available for seed scoping'
);

select private.ensure_cookieworks_dmaic_methodology(
  (select id from cw_dmaic_ids where key = 'organisation')
);

select is(
  (
    select count(*)::integer
    from public.ci_project_methodologies methodology_row
    where methodology_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
  ),
  1,
  'seed creates exactly one CookieWorks DMAIC methodology'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_methodology_versions version_row
    join public.ci_project_methodologies methodology_row
      on methodology_row.organisation_id = version_row.organisation_id
      and methodology_row.id = version_row.methodology_id
    where version_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
      and version_row.status = 'published'
  ),
  1,
  'seed publishes the CookieWorks DMAIC methodology version'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_methodology_phases phase_row
    join public.ci_project_methodology_versions version_row
      on version_row.organisation_id = phase_row.organisation_id
      and version_row.id = phase_row.methodology_version_id
    join public.ci_project_methodologies methodology_row
      on methodology_row.organisation_id = version_row.organisation_id
      and methodology_row.id = version_row.methodology_id
    where phase_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
      and version_row.status = 'published'
  ),
  5,
  'published CookieWorks DMAIC methodology has five DMAIC phases'
);

select private.ensure_cookieworks_dmaic_methodology(
  (select id from cw_dmaic_ids where key = 'organisation')
);

select is(
  (
    select count(*)::integer
    from public.ci_project_methodologies methodology_row
    where methodology_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
  ),
  1,
  're-running the seed is idempotent for methodology rows'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_methodology_versions version_row
    join public.ci_project_methodologies methodology_row
      on methodology_row.organisation_id = version_row.organisation_id
      and methodology_row.id = version_row.methodology_id
    where version_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
      and version_row.status = 'published'
  ),
  1,
  're-running the seed is idempotent for published versions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d2000000-0000-0000-0000-000000000001","email":"cw-dmaic-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from cw_dmaic_ids where key = 'organisation')),
  'owner selects CookieWorks organisation'
);

select ok(
  exists (
    select 1
    from public.ci_project_methodologies methodology_row
    join public.ci_project_methodology_versions version_row
      on version_row.organisation_id = methodology_row.organisation_id
      and version_row.methodology_id = methodology_row.id
    where methodology_row.organisation_id = (select id from cw_dmaic_ids where key = 'organisation')
      and methodology_row.name = 'CookieWorks DMAIC Methodology'
      and methodology_row.status = 'active'
      and version_row.status = 'published'
  ),
  'CookieWorks admin can read the published methodology for charter selection'
);

select * from finish();
rollback;
