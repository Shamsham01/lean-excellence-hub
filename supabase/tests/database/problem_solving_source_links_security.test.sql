begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1b00000-0000-0000-0000-000000000001',
  'ps-source-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1b00000-0000-0000-0000-000000000002',
  'ps-source-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_source_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_source_ids to authenticated;

insert into ps_source_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1b00000-0000-0000-0000-000000000001',
    'ps-source-org',
    'Problem Solving Source Link Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1b10000-0000-0000-0000-000000000001',
  'a1b00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1b10000-0000-0000-0000-000000000002',
  'a1b00000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1b10000-0000-0000-0000-000000000001","email":"ps-source-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_source_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_source_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_source_ids where key = 'organisation'),
  null,
  'source-site',
  'Source Site',
  'site'
);

insert into ps_source_ids (key, id)
select 'project', public.create_improvement_project(
  'Source project for problem solving',
  (select id from ps_source_ids where key = 'unit_root'),
  'Changeovers exceed target',
  'Reduce average changeover time',
  'Lower downtime'
);

insert into ps_source_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Problem from CI project',
  (select id from ps_source_ids where key = 'unit_root'),
  'Changeover duration exceeds target',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  (select id from ps_source_ids where key = 'project')
);

select ok(
  exists (
    select 1
    from public.problem_solving_source_links link_row
    where link_row.case_id = (select id from ps_source_ids where key = 'case')
      and link_row.source_resource_id = (select id from ps_source_ids where key = 'project')
      and link_row.link_role = 'primary'
  ),
  'case links primary CI project source'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from ps_source_ids where key = 'organisation'),
    'a1b00000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_source_ids (key, id)
select 'reader_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1b00000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1b10000-0000-0000-0000-000000000001","email":"ps-source-owner@example.test"}',
  true
);
set local role authenticated;

insert into ps_source_ids (key, id)
select 'reader_role_version', public.create_role_draft(
  (select id from ps_source_ids where key = 'organisation'),
  'problem-solving-reader-only',
  'Problem Solving Reader Only',
  'Read problem solving cases without project access'
);

select ok(
  public.add_role_permission(
    (select id from ps_source_ids where key = 'organisation'),
    (select id from ps_source_ids where key = 'reader_role_version'),
    'problem_solving.view'
  ),
  'reader role receives problem_solving.view'
);

select ok(
  public.publish_role_version(
    (select id from ps_source_ids where key = 'organisation'),
    (select id from ps_source_ids where key = 'reader_role_version')
  ),
  'reader role publishes'
);

insert into ps_source_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from ps_source_ids where key = 'organisation'),
  (select id from ps_source_ids where key = 'reader_membership'),
  (select id from ps_source_ids where key = 'reader_role_version'),
  'organisation',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1b00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1b10000-0000-0000-0000-000000000002","email":"ps-source-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_source_ids where key = 'organisation')),
  'reader selects organisation'
);

select ok(
  public.get_problem_solving_detail((select id from ps_source_ids where key = 'case')) is not null,
  'problem_solving.view grants case detail access'
);

select throws_ok(
  format(
    'select public.get_ci_project_detail(%L::uuid)',
    (select id from ps_source_ids where key = 'project')
  ),
  'project detail is not authorised',
  '42501'
);

select ok(
  not (
    select detail_row -> 'source_links' -> 0 -> 'context' ? 'title'
      or detail_row -> 'source_links' -> 0 -> 'context' ? 'project_number'
    from (
      select public.get_problem_solving_detail((select id from ps_source_ids where key = 'case')) as detail_row
    ) detail_query
  ),
  'problem solving source links do not leak unreadable project context'
);

select * from finish();
rollback;
