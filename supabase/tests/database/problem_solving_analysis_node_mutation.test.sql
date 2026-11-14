begin;

select plan(30);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1900000-0000-0000-0000-000000000001',
  'ps-node-mutation-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1900000-0000-0000-0000-000000000002',
  'ps-node-mutation-contributor@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1900000-0000-0000-0000-000000000003',
  'ps-node-mutation-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_node_mutation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_node_mutation_ids to authenticated;

insert into ps_node_mutation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1900000-0000-0000-0000-000000000001',
    'ps-node-mutation-org',
    'Problem Solving Node Mutation Organisation'
  )
);

insert into ps_node_mutation_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'a1900000-0000-0000-0000-000000000003',
    'ps-node-mutation-other',
    'Problem Solving Node Mutation Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1910000-0000-0000-0000-000000000001',
  'a1900000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1910000-0000-0000-0000-000000000002',
  'a1900000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a1910000-0000-0000-0000-000000000003',
  'a1900000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000001","email":"ps-node-mutation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_node_mutation_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_node_mutation_ids where key = 'organisation'),
  null,
  'node-mutation-site',
  'Node Mutation Site',
  'site'
);

insert into ps_node_mutation_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_node_mutation_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_node_mutation_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Fishbone node mutation case',
  (select id from ps_node_mutation_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_node_mutation_ids where key = 'case'),
    (select id from ps_node_mutation_ids where key = 'rapid_method')
  ),
  'case activates for node mutation tests'
);

insert into ps_node_mutation_ids (key, id)
select 'fishbone_analysis', public.create_analysis(
  (select id from ps_node_mutation_ids where key = 'case'),
  'fishbone',
  'Seal defect fishbone'
);

insert into ps_node_mutation_ids (key, id)
select 'leaf_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'fishbone_analysis'),
  'Guide roller wear',
  null,
  'machine',
  1
);

insert into ps_node_mutation_ids (key, id)
select 'parent_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'fishbone_analysis'),
  'Parent cause bucket',
  null,
  'method',
  2
);

insert into ps_node_mutation_ids (key, id)
select 'child_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'fishbone_analysis'),
  'Child detail cause',
  (select id from ps_node_mutation_ids where key = 'parent_node'),
  'method',
  3
);

select set_config(
  'psnm.leaf_node',
  (select id::text from ps_node_mutation_ids where key = 'leaf_node'),
  true
);

reset role;

set local role anon;

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    current_setting('psnm.leaf_node')::uuid,
    'Anon edit attempt'
  ),
  '42501',
  null,
  'anon cannot execute update_analysis_node'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    current_setting('psnm.leaf_node')::uuid
  ),
  '42501',
  null,
  'anon cannot execute delete_analysis_node'
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid)',
    current_setting('psnm.leaf_node')::uuid
  ),
  '42501',
  null,
  'anon cannot execute promote_analysis_node_to_hypothesis'
);

reset role;
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'organisation')),
  'owner re-selects organisation after anon probe'
);

select ok(
  public.update_analysis_node(
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    'Guide roller wear after heat soak'
  ),
  'manager can update a fishbone leaf node'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    ''
  ),
  'cause label is required',
  '22023'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    repeat('x', 501)
  ),
  'cause label must be 500 characters or fewer',
  '22023'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000003","email":"ps-node-mutation-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'other_organisation')),
  'other org user selects their organisation'
);

insert into ps_node_mutation_ids (key, id)
select 'other_unit', public.create_organisation_unit(
  (select id from ps_node_mutation_ids where key = 'other_organisation'),
  null,
  'other-site',
  'Other Site',
  'site'
);

insert into ps_node_mutation_ids (key, id)
select 'other_case', public.create_problem_solving_case_draft(
  'Other org case',
  (select id from ps_node_mutation_ids where key = 'other_unit')
);

insert into ps_node_mutation_ids (key, id)
select 'other_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_node_mutation_ids where key = 'other_organisation')
  and method_row.builtin_code = 'rapid_rca';

select ok(
  public.activate_problem_solving_case(
    (select id from ps_node_mutation_ids where key = 'other_case'),
    (select id from ps_node_mutation_ids where key = 'other_method')
  ),
  'other org case activates'
);

insert into ps_node_mutation_ids (key, id)
select 'other_analysis', public.create_analysis(
  (select id from ps_node_mutation_ids where key = 'other_case'),
  'fishbone',
  'Other org fishbone'
);

insert into ps_node_mutation_ids (key, id)
select 'other_org_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'other_analysis'),
  'Foreign org cause',
  null,
  'machine',
  1
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000001","email":"ps-node-mutation-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'organisation')),
  'owner returns to primary organisation'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'other_org_node'),
    'Should not see other organisation node'
  ),
  'analysis node not found',
  'P0002'
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
    (select id from ps_node_mutation_ids where key = 'organisation'),
    'a1900000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ps_node_mutation_ids (key, id)
select 'contributor_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1900000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000001","email":"ps-node-mutation-owner@example.test"}',
  true
);
set local role authenticated;

insert into ps_node_mutation_ids (key, id)
select 'contributor_role_version', public.create_role_draft(
  (select id from ps_node_mutation_ids where key = 'organisation'),
  'ps-node-mutation-contributor-only',
  'Contributor without manage',
  'Contribute to cases without problem_solving.manage permission'
);

select ok(
  public.add_role_permission(
    (select id from ps_node_mutation_ids where key = 'organisation'),
    (select id from ps_node_mutation_ids where key = 'contributor_role_version'),
    'problem_solving.view'
  ),
  'contributor role receives problem_solving.view'
);

select ok(
  public.add_role_permission(
    (select id from ps_node_mutation_ids where key = 'organisation'),
    (select id from ps_node_mutation_ids where key = 'contributor_role_version'),
    'problem_solving.contribute'
  ),
  'contributor role receives problem_solving.contribute'
);

select ok(
  public.publish_role_version(
    (select id from ps_node_mutation_ids where key = 'organisation'),
    (select id from ps_node_mutation_ids where key = 'contributor_role_version')
  ),
  'contributor role publishes'
);

insert into ps_node_mutation_ids (key, id)
select 'contributor_grant', public.grant_role_version(
  (select id from ps_node_mutation_ids where key = 'organisation'),
  (select id from ps_node_mutation_ids where key = 'contributor_membership'),
  (select id from ps_node_mutation_ids where key = 'contributor_role_version'),
  'organisation',
  null
);

select ok(
  (select id from ps_node_mutation_ids where key = 'contributor_grant') is not null,
  'contributor grant applied'
);

insert into ps_node_mutation_ids (key, id)
select 'contributor_participant', public.add_problem_solving_participant(
  (select id from ps_node_mutation_ids where key = 'case'),
  (select id from ps_node_mutation_ids where key = 'contributor_membership'),
  'contributor'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000002","email":"ps-node-mutation-contributor@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'organisation')),
  'contributor selects organisation'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    'Contributor edit attempt'
  ),
  'analysis node update is not authorised',
  '42501'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'leaf_node')
  ),
  'analysis node deletion is not authorised',
  '42501'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000001","email":"ps-node-mutation-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from ps_node_mutation_ids where key = 'organisation')),
  'owner returns after contributor probe'
);

select ok(
  public.cancel_problem_solving_case(
    (select id from ps_node_mutation_ids where key = 'case'),
    'Cancelled for closed-case mutation test'
  ),
  'case cancelled for mutation guard'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    'Cannot edit on cancelled case'
  ),
  'case is closed; analysis cannot be changed',
  '55000'
);

insert into ps_node_mutation_ids (key, id)
select 'active_case', public.create_problem_solving_case_draft(
  'Promoted node mutation case',
  (select id from ps_node_mutation_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_node_mutation_ids where key = 'active_case'),
    (select id from ps_node_mutation_ids where key = 'rapid_method')
  ),
  'second case stays active for promoted node tests'
);

insert into ps_node_mutation_ids (key, id)
select 'active_analysis', public.create_analysis(
  (select id from ps_node_mutation_ids where key = 'active_case'),
  'fishbone',
  'Promoted fishbone'
);

insert into ps_node_mutation_ids (key, id)
select 'promoted_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'active_analysis'),
  'Cause linked to hypothesis',
  null,
  'machine',
  1
);

insert into ps_node_mutation_ids (key, id)
select 'promoted_hypothesis', public.promote_analysis_node_to_hypothesis(
  (select id from ps_node_mutation_ids where key = 'promoted_node')
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'promoted_node')
  ),
  'this cause is already promoted to a hypothesis',
  '55000'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'promoted_node'),
    'Promoted edit attempt'
  ),
  'promoted fishbone causes cannot be changed; edit the hypothesis instead',
  '55000'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'promoted_node')
  ),
  'promoted fishbone causes cannot be removed; edit the hypothesis instead',
  '55000'
);

insert into ps_node_mutation_ids (key, id)
select 'delete_parent_case', public.create_problem_solving_case_draft(
  'Delete parent guard case',
  (select id from ps_node_mutation_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_node_mutation_ids where key = 'delete_parent_case'),
    (select id from ps_node_mutation_ids where key = 'rapid_method')
  ),
  'delete parent case activates'
);

insert into ps_node_mutation_ids (key, id)
select 'delete_parent_analysis', public.create_analysis(
  (select id from ps_node_mutation_ids where key = 'delete_parent_case'),
  'fishbone',
  'Parent delete guard fishbone'
);

insert into ps_node_mutation_ids (key, id)
select 'delete_parent', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'delete_parent_analysis'),
  'Parent fishbone cause',
  null,
  'method',
  1
);

insert into ps_node_mutation_ids (key, id)
select 'delete_child', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'delete_parent_analysis'),
  'Child fishbone cause',
  (select id from ps_node_mutation_ids where key = 'delete_parent'),
  'method',
  2
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'delete_parent')
  ),
  'remove child causes before deleting this node',
  '55000'
);

insert into ps_node_mutation_ids (key, id)
select 'non_fishbone_analysis', public.create_analysis(
  (select id from ps_node_mutation_ids where key = 'delete_parent_case'),
  'five_whys',
  'Non-fishbone update guard'
);

insert into ps_node_mutation_ids (key, id)
select 'non_fishbone_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'non_fishbone_analysis'),
  'Five why step',
  null,
  'problem',
  1
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'non_fishbone_node'),
    'Five why edit attempt'
  ),
  'only fishbone causes can be changed here',
  '55000'
);

select * from finish();
rollback;