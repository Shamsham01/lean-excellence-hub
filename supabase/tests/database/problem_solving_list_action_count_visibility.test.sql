begin;

select plan(32);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c1b00000-0000-0000-0000-000000000001',
  'vis1b-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1b00000-0000-0000-0000-000000000002',
  'vis1b-ps-only@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1b00000-0000-0000-0000-000000000003',
  'vis1b-dual@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1b00000-0000-0000-0000-000000000004',
  'vis1b-mixed@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1b00000-0000-0000-0000-000000000005',
  'vis1b-scope-manager@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1b00000-0000-0000-0000-000000000006',
  'vis1b-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table vis1b_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on vis1b_ids to authenticated, lean_hub_private_owner;

insert into vis1b_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1b00000-0000-0000-0000-000000000001',
    'vis1b-org',
    'VIS1b Open Action Count Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c1b10000-0000-0000-0000-000000000001',
  'c1b00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c1b10000-0000-0000-0000-000000000002',
  'c1b00000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'c1b10000-0000-0000-0000-000000000003',
  'c1b00000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'c1b10000-0000-0000-0000-000000000004',
  'c1b00000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'c1b10000-0000-0000-0000-000000000005',
  'c1b00000-0000-0000-0000-000000000005',
  statement_timestamp(), statement_timestamp()
),
(
  'c1b10000-0000-0000-0000-000000000006',
  'c1b00000-0000-0000-0000-000000000006',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000001","email":"vis1b-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into vis1b_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from vis1b_ids where key = 'organisation'),
  null,
  'vis1b-root',
  'VIS1b Root Site',
  'site'
);

insert into vis1b_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'root_unit'),
  'vis1b-child',
  'VIS1b Child Department',
  'department'
);

insert into vis1b_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'root_unit'),
  'vis1b-sibling',
  'VIS1b Sibling Department',
  'department'
);

insert into vis1b_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from vis1b_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into vis1b_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'VIS1b linked action case',
  (select id from vis1b_ids where key = 'child_unit'),
  'Containment response required'
);

select ok(
  public.activate_problem_solving_case(
    (select id from vis1b_ids where key = 'case'),
    (select id from vis1b_ids where key = 'rapid_method')
  ),
  'owner activates case for open action count tests'
);

insert into vis1b_ids (key, id)
select 'containment', public.create_containment(
  (select id from vis1b_ids where key = 'case'),
  'Segregate affected material',
  'Prevent further exposure'
);

insert into vis1b_ids (key, id)
select 'secret_action', public.create_problem_solving_action(
  'VIS1B_SECRET_ACTION_TITLE',
  (select id from vis1b_ids where key = 'case'),
  'containment',
  (select id from vis1b_ids where key = 'containment'),
  null,
  null,
  'VIS1B_SECRET_ACTION_DESCRIPTION'
);

insert into vis1b_ids (key, id)
select 'completed_action', public.create_problem_solving_action(
  'VIS1B_COMPLETED_ACTION_TITLE',
  (select id from vis1b_ids where key = 'case'),
  'containment',
  (select id from vis1b_ids where key = 'containment'),
  null,
  null,
  'VIS1B_COMPLETED_ACTION_DESCRIPTION'
);

insert into vis1b_ids (key, id)
select 'case_sibling', public.create_problem_solving_case_draft(
  'VIS1b sibling unit case',
  (select id from vis1b_ids where key = 'sibling_unit'),
  'Sibling unit problem statement'
);

select ok(
  public.activate_problem_solving_case(
    (select id from vis1b_ids where key = 'case_sibling'),
    (select id from vis1b_ids where key = 'rapid_method')
  ),
  'owner activates sibling unit case'
);

insert into vis1b_ids (key, id)
select 'sibling_containment', public.create_containment(
  (select id from vis1b_ids where key = 'case_sibling'),
  'Sibling containment',
  'Sibling containment rationale'
);

insert into vis1b_ids (key, id)
select 'sibling_action', public.create_problem_solving_action(
  'VIS1B_SIBLING_UNIT_ACTION',
  (select id from vis1b_ids where key = 'case_sibling'),
  'containment',
  (select id from vis1b_ids where key = 'sibling_containment')
);

reset role;

set local role lean_hub_private_owner;

update public.actions
set status = 'completed',
    completed_at = statement_timestamp()
where organisation_id = (select id from vis1b_ids where key = 'organisation')
  and id = (select id from vis1b_ids where key = 'completed_action');

reset role;

with inserted_memberships as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values
  (
    (select id from vis1b_ids where key = 'organisation'),
    'c1b00000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from vis1b_ids where key = 'organisation'),
    'c1b00000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  ),
  (
    (select id from vis1b_ids where key = 'organisation'),
    'c1b00000-0000-0000-0000-000000000004',
    'active',
    statement_timestamp()
  ),
  (
    (select id from vis1b_ids where key = 'organisation'),
    'c1b00000-0000-0000-0000-000000000005',
    'active',
    statement_timestamp()
  )
  returning user_id, id
)
insert into vis1b_ids (key, id)
select
  case inserted_memberships.user_id
    when 'c1b00000-0000-0000-0000-000000000002' then 'ps_only_membership'
    when 'c1b00000-0000-0000-0000-000000000003' then 'dual_membership'
    when 'c1b00000-0000-0000-0000-000000000004' then 'mixed_membership'
    when 'c1b00000-0000-0000-0000-000000000005' then 'scope_manager_membership'
  end,
  inserted_memberships.id
from inserted_memberships;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'c1b00000-0000-0000-0000-000000000002',
  'c1b00000-0000-0000-0000-000000000003',
  'c1b00000-0000-0000-0000-000000000004',
  'c1b00000-0000-0000-0000-000000000005'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000001","email":"vis1b-owner@example.test"}',
  true
);
set local role authenticated;

insert into vis1b_ids (key, id)
select 'ps_only_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-ps-only',
  'VIS1b Problem Solving Reader',
  'Read problem solving without action access'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'ps_only_role'),
    'problem_solving.view'
  ),
  'ps-only role receives problem_solving.view'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'ps_only_role')
  ),
  'ps-only role publishes'
);

insert into vis1b_ids (key, id)
select 'dual_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-ps-action-reader',
  'VIS1b Problem Solving and Action Reader',
  'Read problem solving and all actions'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'dual_role'),
    'problem_solving.view'
  ),
  'dual role receives problem_solving.view'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'dual_role'),
    'actions.read'
  ),
  'dual role receives actions.read'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'dual_role')
  ),
  'dual role publishes'
);

insert into vis1b_ids (key, id)
select 'mixed_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-ps-self-action',
  'VIS1b Self-Scoped Action Reader',
  'Read problem solving and self-scoped actions'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_role'),
    'problem_solving.view'
  ),
  'mixed role receives problem_solving.view'
);

insert into vis1b_ids (key, id)
select 'mixed_read_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-mixed-action-read',
  'VIS1b Self Action Reader',
  'Read self-created actions'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_read_role'),
    'actions.read'
  ),
  'mixed read role receives actions.read'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_read_role')
  ),
  'mixed read role publishes'
);

insert into vis1b_ids (key, id)
select 'mixed_create_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-mixed-action-create',
  'VIS1b Action Creator',
  'Create actions for mixed visibility scenario'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_create_role'),
    'actions.create'
  ),
  'mixed create role receives actions.create'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_create_role')
  ),
  'mixed create role publishes'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'mixed_role')
  ),
  'mixed problem solving role publishes'
);

insert into vis1b_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from vis1b_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

insert into vis1b_ids (key, id)
select 'ps_only_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'ps_only_membership'),
  (select id from vis1b_ids where key = 'ps_only_role'),
  'organisation',
  null
);

insert into vis1b_ids (key, id)
select 'dual_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'dual_membership'),
  (select id from vis1b_ids where key = 'dual_role'),
  'organisation',
  null
);

insert into vis1b_ids (key, id)
select 'scope_ps_role', public.create_role_draft(
  (select id from vis1b_ids where key = 'organisation'),
  'vis1b-scope-ps-view',
  'VIS1b Organisation Problem Solving Reader',
  'Read all problem solving cases without action access'
);

select ok(
  public.add_role_permission(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'scope_ps_role'),
    'problem_solving.view'
  ),
  'scope manager receives organisation-wide problem_solving.view'
);

select ok(
  public.publish_role_version(
    (select id from vis1b_ids where key = 'organisation'),
    (select id from vis1b_ids where key = 'scope_ps_role')
  ),
  'scope manager problem solving role publishes'
);

insert into vis1b_ids (key, id)
select 'scope_manager_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'scope_manager_membership'),
  (select id from vis1b_ids where key = 'manager_role_version'),
  'unit_subtree',
  (select id from vis1b_ids where key = 'child_unit')
);

insert into vis1b_ids (key, id)
select 'scope_ps_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'scope_manager_membership'),
  (select id from vis1b_ids where key = 'scope_ps_role'),
  'organisation',
  null
);

insert into vis1b_ids (key, id)
select 'mixed_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'mixed_membership'),
  (select id from vis1b_ids where key = 'mixed_role'),
  'organisation',
  null
);

insert into vis1b_ids (key, id)
select 'mixed_read_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'mixed_membership'),
  (select id from vis1b_ids where key = 'mixed_read_role'),
  'self',
  null
);

insert into vis1b_ids (key, id)
select 'mixed_create_grant', public.grant_role_version(
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'mixed_membership'),
  (select id from vis1b_ids where key = 'mixed_create_role'),
  'organisation',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000004","email":"vis1b-mixed@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'mixed reader selects organisation before self-created action'
);

insert into vis1b_ids (key, id)
select 'self_visible_action', public.create_action(
  'VIS1B_SELF_VISIBLE_ACTION',
  'Action created by mixed reader',
  'normal',
  (select id from vis1b_ids where key = 'child_unit')
);

reset role;

set local role lean_hub_private_owner;

insert into public.problem_solving_action_context (
  organisation_id,
  problem_solving_case_id,
  action_id,
  context_role,
  containment_id,
  created_by_membership_id
)
select
  (select id from vis1b_ids where key = 'organisation'),
  (select id from vis1b_ids where key = 'case'),
  (select id from vis1b_ids where key = 'self_visible_action'),
  'containment',
  (select id from vis1b_ids where key = 'containment'),
  (select id from vis1b_ids where key = 'mixed_membership');

update public.actions
set status = 'in_progress'
where organisation_id = (select id from vis1b_ids where key = 'organisation')
  and id = (select id from vis1b_ids where key = 'self_visible_action');

reset role;

create or replace function pg_temp.vis1b_open_action_count(target_case_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    (
      select (item ->> 'open_action_count')::integer
      from jsonb_array_elements(
        public.get_problem_solving_list() -> 'items'
      ) item
      where (item ->> 'id')::uuid = target_case_id
    ),
    -1
  );
$$;

-- Scenario H/J: fully authorised owner sees accurate readable open action count
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000001","email":"vis1b-owner@example.test"}',
  true
);
set local role authenticated;

select is(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  2,
  'authorised owner open_action_count includes readable open and in_progress actions only'
);

select is(
  jsonb_array_length(
    public.get_problem_solving_detail((select id from vis1b_ids where key = 'case')) -> 'actions'
  ),
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  'owner list open_action_count matches detail readable open action cardinality'
);

-- Scenario A: parent and child both readable
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000003","email":"vis1b-dual@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'dual reader selects organisation'
);

select ok(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')) = 2,
  'dual reader open_action_count includes independently readable linked actions'
);

-- Scenario B/I/D: parent readable, unreadable linked actions do not contribute
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000002","email":"vis1b-ps-only@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'ps-only reader selects organisation'
);

select is(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  0,
  'ps-only reader open_action_count excludes unreadable linked actions'
);

select is(
  jsonb_array_length(
    public.get_problem_solving_detail((select id from vis1b_ids where key = 'case')) -> 'actions'
  ),
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  'ps-only list count matches detail readable action cardinality'
);

-- Scenario C: mixed linked actions on one case
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000004","email":"vis1b-mixed@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'mixed reader selects organisation'
);

select is(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  1,
  'mixed reader open_action_count includes only independently readable linked action'
);

-- Scenario E: completed readable action does not contribute
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000001","email":"vis1b-owner@example.test"}',
  true
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_problem_solving_detail((select id from vis1b_ids where key = 'case')) -> 'actions'
    ) action_row
    where (action_row ->> 'id')::uuid = (select id from vis1b_ids where key = 'completed_action')
  ),
  'owner can still read completed linked action in detail'
);

select is(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case')),
  2,
  'completed readable linked action does not contribute to open_action_count'
);

-- Scenario G: scope boundary on sibling unit action
select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000005","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000005","email":"vis1b-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation')),
  'scope manager selects organisation'
);

select is(
  pg_temp.vis1b_open_action_count((select id from vis1b_ids where key = 'case_sibling')),
  0,
  'scope manager open_action_count excludes out-of-subtree linked action'
);

-- Scenario F: cross-tenant isolation
reset role;

insert into vis1b_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'c1b00000-0000-0000-0000-000000000006',
    'vis1b-org-b',
    'VIS1b Outsider Organisation'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1b00000-0000-0000-0000-000000000006","role":"authenticated","session_id":"c1b10000-0000-0000-0000-000000000006","email":"vis1b-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from vis1b_ids where key = 'organisation_b')),
  'outsider selects own organisation'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_problem_solving_list() -> 'items'
    ) item
    where (item ->> 'id')::uuid = (select id from vis1b_ids where key = 'case')
  ),
  'cross-tenant caller list does not include foreign case or leak open_action_count'
);

select * from finish();
rollback;
