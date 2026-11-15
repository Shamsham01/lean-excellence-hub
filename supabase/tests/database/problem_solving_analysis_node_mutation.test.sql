begin;

select plan(42);

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

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.promote_analysis_node_to_hypothesis(uuid, text, text)',
    'execute'
  ),
  'anon role lacks execute privilege on promote_analysis_node_to_hypothesis'
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
  '22023',
  'cause label is required',
  'blank cause label rejected'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    repeat('x', 501)
  ),
  '22023',
  'cause label must be 500 characters or fewer',
  'oversize cause label rejected'
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'leaf_node'),
    repeat('x', 2001)
  ),
  '22023',
  'hypothesis statement must be 2000 characters or fewer',
  'oversize promote statement rejected'
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
  'P0002',
  'analysis node not found',
  'cross-org update blocked'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'other_org_node')
  ),
  'P0002',
  'analysis node not found',
  'cross-org delete blocked'
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'other_org_node')
  ),
  'P0002',
  'analysis node not found',
  'cross-org promote blocked'
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
  '42501',
  'analysis node update is not authorised',
  'contributor cannot update analysis node'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'leaf_node')
  ),
  '42501',
  'analysis node deletion is not authorised',
  'contributor cannot delete analysis node'
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'leaf_node')
  ),
  '42501',
  'hypothesis promotion is not authorised',
  'contributor cannot promote analysis node'
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
  '55000',
  'case is closed; analysis cannot be changed',
  'cancelled case blocks update'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'leaf_node')
  ),
  '55000',
  'case is closed; analysis cannot be changed',
  'cancelled case blocks delete'
);

select throws_ok(
  format(
    'select public.promote_analysis_node_to_hypothesis(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'leaf_node')
  ),
  '55000',
  'case is closed; analysis cannot be changed',
  'cancelled case blocks promote'
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
  '55000',
  'this cause is already promoted to a hypothesis',
  'double promote rejected'
);

select throws_ok(
  format(
    'select public.update_analysis_node(%L::uuid, %L)',
    (select id from ps_node_mutation_ids where key = 'promoted_node'),
    'Promoted edit attempt'
  ),
  '55000',
  'promoted fishbone causes cannot be changed; edit the hypothesis instead',
  'promoted node update rejected'
);

select throws_ok(
  format(
    'select public.delete_analysis_node(%L::uuid)',
    (select id from ps_node_mutation_ids where key = 'promoted_node')
  ),
  '55000',
  'promoted fishbone causes cannot be removed; edit the hypothesis instead',
  'promoted node delete rejected'
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
  '55000',
  'remove child causes before deleting this node',
  'parent delete blocked while children exist'
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
  '55000',
  'only fishbone causes can be changed here',
  'non-fishbone update rejected'
);

insert into ps_node_mutation_ids (key, id)
select 'link_test_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'active_analysis'),
  'Unlinked cause for hypothesis link test',
  null,
  'machine',
  2
);

insert into ps_node_mutation_ids (key, id)
select 'link_hypothesis_a', public.create_hypothesis(
  (select id from ps_node_mutation_ids where key = 'active_case'),
  'Primary link target hypothesis'
);

insert into ps_node_mutation_ids (key, id)
select 'link_hypothesis_b', public.create_hypothesis(
  (select id from ps_node_mutation_ids where key = 'active_case'),
  'Alternate link target hypothesis'
);

select ok(
  public.link_node_hypothesis(
    (select id from ps_node_mutation_ids where key = 'link_test_node'),
    (select id from ps_node_mutation_ids where key = 'link_hypothesis_a')
  ),
  'manager can link node to first hypothesis'
);

select throws_ok(
  format(
    'select public.link_node_hypothesis(%L::uuid, %L::uuid)',
    (select id from ps_node_mutation_ids where key = 'link_test_node'),
    (select id from ps_node_mutation_ids where key = 'link_hypothesis_b')
  ),
  '55000',
  'fishbone cause already has a different linked hypothesis',
  'relink to different hypothesis rejected'
);

select ok(
  public.link_node_hypothesis(
    (select id from ps_node_mutation_ids where key = 'promoted_node'),
    (select id from ps_node_mutation_ids where key = 'promoted_hypothesis')
  ),
  'linking same hypothesis again is a no-op'
);

insert into ps_node_mutation_ids (key, id)
select 'deletable_node', public.add_analysis_node(
  (select id from ps_node_mutation_ids where key = 'active_analysis'),
  'Temporary fishbone cause',
  null,
  'method',
  7
);

select ok(
  public.delete_analysis_node(
    (select id from ps_node_mutation_ids where key = 'deletable_node')
  ),
  'manager can delete non-promoted fishbone cause'
);

select throws_ok(
  format(
    'select public.link_node_hypothesis(%L::uuid, %L::uuid)',
    (select id from ps_node_mutation_ids where key = 'non_fishbone_node'),
    (select id from ps_node_mutation_ids where key = 'link_hypothesis_a')
  ),
  '55000',
  'only fishbone causes can be linked to a hypothesis',
  'non-fishbone link_node_hypothesis rejected'
);

select * from finish();
rollback;