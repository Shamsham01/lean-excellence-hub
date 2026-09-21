begin;

select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'f1000000-0000-0000-0000-000000000001',
  'benefit-project-scope@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table scope_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on scope_ids to authenticated;

insert into scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'benefit-project-scope-org',
    'Benefit Project Scope Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'f1100000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"benefit-project-scope@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from scope_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into scope_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from scope_ids where key = 'organisation'),
  null,
  'site-a',
  'Site A',
  'site'
);

insert into scope_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from scope_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into scope_ids (key, id)
select 'site_a_ops', public.create_organisation_unit(
  (select id from scope_ids where key = 'organisation'),
  (select id from scope_ids where key = 'site_a'),
  'site-a-ops',
  'Operations',
  'department'
);

insert into scope_ids (key, id)
select 'site_a_packing', public.create_organisation_unit(
  (select id from scope_ids where key = 'organisation'),
  (select id from scope_ids where key = 'site_a_ops'),
  'site-a-packing',
  'Packing',
  'area'
);

insert into scope_ids (key, id)
select 'project_site_root', public.create_improvement_project(
  'Site A root project',
  (select id from scope_ids where key = 'site_a'),
  'Root problem',
  'Root objective',
  'Root impact'
);

insert into scope_ids (key, id)
select 'project_packing', public.create_improvement_project(
  'Site A packing project',
  (select id from scope_ids where key = 'site_a_packing'),
  'Packing problem',
  'Packing objective',
  'Packing impact'
);

insert into scope_ids (key, id)
select 'project_site_b', public.create_improvement_project(
  'Site B project',
  (select id from scope_ids where key = 'site_b'),
  'Site B problem',
  'Site B objective',
  'Site B impact'
);

select ok(
  (
    select project_row.site_unit_id = (select id from scope_ids where key = 'site_a')
    from public.ci_projects project_row
    where project_row.id = (select id from scope_ids where key = 'project_packing')
  ),
  'packing project snapshots Site A as site_unit_id'
);

select ok(
  (
    select count(*) = 2
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        null,
        null,
        1,
        25,
        (select id from scope_ids where key = 'site_a')
      ) -> 'items'
    ) portfolio_item
    where portfolio_item ->> 'id' in (
      (select id::text from scope_ids where key = 'project_site_root'),
      (select id::text from scope_ids where key = 'project_packing')
    )
  ),
  'target_site_unit_id returns Site A root and descendant-unit projects'
);

select ok(
  (
    select count(*) = 0
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        null,
        null,
        1,
        25,
        (select id from scope_ids where key = 'site_a')
      ) -> 'items'
    ) portfolio_item
    where portfolio_item ->> 'id' = (select id::text from scope_ids where key = 'project_site_b')
  ),
  'target_site_unit_id excludes projects from another site'
);

select ok(
  (
    select count(*) = 1
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        (select id from scope_ids where key = 'site_a_ops'),
        null,
        1,
        25,
        null
      ) -> 'items'
    ) portfolio_item
    where portfolio_item ->> 'id' = (select id::text from scope_ids where key = 'project_packing')
  ),
  'target_unit_id matches descendant-unit projects via closure subtree'
);

select ok(
  (
    select count(*) = 0
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        (select id from scope_ids where key = 'site_a_ops'),
        null,
        1,
        25,
        null
      ) -> 'items'
    ) portfolio_item
    where portfolio_item ->> 'id' = (select id::text from scope_ids where key = 'project_site_root')
  ),
  'target_unit_id subtree does not include ancestor-only projects'
);

select ok(
  (
    select portfolio_item ? 'site_unit_id'
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        null,
        null,
        1,
        25,
        (select id from scope_ids where key = 'site_a')
      ) -> 'items'
    ) portfolio_item
    limit 1
  ),
  'portfolio items expose site_unit_id for client pickers'
);

select * from finish();

rollback;
