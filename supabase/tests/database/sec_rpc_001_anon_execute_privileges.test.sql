begin;

select plan(41);

-- Privilege inventory after SEC-RPC-001. Signatures match hosted/local catalogs.
create temporary table sec_rpc_restricted_sigs (
  signature text primary key
) on commit drop;

insert into sec_rpc_restricted_sigs (signature)
values
  ('public.add_benefit_source_link(uuid,uuid,text)'),
  ('public.add_benefit_to_overlap_group(uuid,uuid,numeric,text)'),
  ('public.add_five_s_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb,boolean,jsonb,numeric)'),
  ('public.add_five_s_section(uuid,text,integer)'),
  ('public.add_gemba_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb)'),
  ('public.add_gemba_section(uuid,text,integer)'),
  ('public.add_suggestion_contributor(uuid,uuid,text)'),
  ('public.assign_suggestion_reviewer(uuid,uuid)'),
  ('public.award_recognition(uuid,text,text,uuid,text,uuid[],uuid,text[])'),
  ('public.begin_suggestion_implementation(uuid)'),
  ('public.begin_suggestion_review(uuid)'),
  ('public.complete_five_s_audit(uuid)'),
  ('public.complete_gemba_walk(uuid,text)'),
  ('public.create_benefit_draft(text,uuid,text,text,text,text,uuid,uuid,boolean,uuid)'),
  ('public.create_benefit_from_ci_project(uuid,text,text,text,text,text,uuid,uuid,uuid)'),
  ('public.create_benefit_from_suggestion(uuid,text,text,text,text,text,uuid,uuid,uuid)'),
  ('public.create_benefit_overlap_group(text,text)'),
  ('public.create_five_s_action(text,uuid,uuid,uuid,uuid,text,text,timestamp with time zone)'),
  ('public.create_five_s_finding(uuid,text,uuid,uuid,text,text,boolean)'),
  ('public.create_gemba_action(text,uuid,uuid,uuid,uuid,text,text,timestamp with time zone)'),
  ('public.create_improvement_project(text,uuid,text,text,text,uuid)'),
  ('public.create_improvement_project_from_suggestion(uuid)'),
  ('public.create_recognition_type(text,text,text)'),
  ('public.create_suggestion_action(uuid,text,text,text,timestamp with time zone,text)'),
  ('public.create_suggestion_category(text,text,text,integer)'),
  ('public.create_suggestion_draft(uuid,uuid,text,text,text,text,uuid,uuid)'),
  ('public.create_suggestion_programme_draft(text,text,text)'),
  ('public.create_suggestion_programme_successor_version(uuid)'),
  ('public.get_membership_improvement_contribution(uuid)'),
  ('public.get_membership_recognition(uuid)'),
  ('public.get_recognition_feed(integer,integer)'),
  ('public.get_suggestion_review_queue()'),
  ('public.get_suggestions_list(text,text,integer,integer)'),
  ('public.get_suggestions_overview()'),
  ('public.link_five_s_evidence(uuid,uuid,uuid,uuid,uuid)'),
  ('public.member_has_permission(text)'),
  ('public.publish_five_s_standard_version(uuid)'),
  ('public.publish_gemba_definition_version(uuid)'),
  ('public.publish_suggestion_programme_version(uuid)'),
  ('public.remove_benefit_from_overlap_group(uuid,uuid,text)'),
  ('public.remove_benefit_source_link(uuid,uuid)'),
  ('public.revoke_recognition(uuid,text)'),
  ('public.start_five_s_audit(uuid,uuid,uuid)'),
  ('public.start_gemba_walk(uuid,uuid,uuid)'),
  ('public.submit_ci_project_charter(uuid)'),
  ('public.submit_suggestion(uuid)'),
  ('public.update_benefit_draft(uuid,text,text,text,text,text,uuid,uuid,uuid,text,date,date,numeric,text,numeric,date,date,boolean)'),
  ('public.update_benefit_overlap_allocation(uuid,uuid,numeric,text)'),
  ('public.update_suggestion_draft(uuid,text,text,text,text,uuid,uuid,uuid)'),
  ('public.upsert_five_s_audit_answer(uuid,uuid,boolean,text,numeric,date,jsonb)'),
  ('public.upsert_gemba_walk_answer(uuid,uuid,boolean,text,numeric,date,jsonb)'),
  ('public.withdraw_suggestion(uuid,text)');

select is(
  (select count(*) from sec_rpc_restricted_sigs),
  52::bigint,
  'SEC-RPC-001 operational revoke inventory has 52 signatures'
);

select is(
  (
    select count(*)
    from sec_rpc_restricted_sigs
    where pg_catalog.has_function_privilege('anon', signature, 'EXECUTE')
      or pg_catalog.has_function_privilege('public', signature, 'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE')
  ),
  0::bigint,
  'restricted operational RPCs deny anon/public and retain authenticated EXECUTE'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.get_workforce_provision_intent_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute workforce provision worker RPC'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_workforce_provision_intent_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute workforce provision worker RPC'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.get_workforce_provision_intent_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute workforce provision worker RPC'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.get_workforce_provision_intent_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role retains EXECUTE on workforce provision worker RPC'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.get_workforce_provision_intent_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute private workforce provision worker helper'
);

select ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.preview_organisation_invitation(bytea)',
    'EXECUTE'
  ),
  'anon retains EXECUTE on invitation preview'
);

select ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.prepare_organisation_invitation_signup_binding(bytea)',
    'EXECUTE'
  ),
  'anon retains EXECUTE on invitation signup binding'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.issue_organisation_member_invitation(text,text,bytea,timestamp with time zone,uuid,text,uuid,text,uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot issue member invitations'
);

select ok(
  pg_catalog.has_function_privilege(
    'lean_hub_private_owner',
    'public.member_has_permission(text)',
    'EXECUTE'
  ),
  'private owner retains EXECUTE on member_has_permission for recognition RLS helpers'
);

select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'invitation_default_ttl'
  ),
  array['search_path=""']::text[],
  'invitation_default_ttl has empty search_path'
);

select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'mask_invitation_email'
  ),
  array['search_path=""']::text[],
  'mask_invitation_email has empty search_path'
);

select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'role_responsibility_kind'
  ),
  array['search_path=""']::text[],
  'role_responsibility_kind has empty search_path'
);

select is(
  private.invitation_default_ttl(),
  interval '7 days',
  'invitation TTL helper still returns seven days after search_path pin'
);

select is(
  private.mask_invitation_email('alex.owner@example.test'),
  'a***@example.test',
  'invitation email mask helper still works after search_path pin'
);

select is(
  private.role_responsibility_kind('organisation-owner', null, true),
  'owner',
  'role responsibility helper still classifies owner after search_path pin'
);

set local role anon;

select throws_ok(
  $$ select public.member_has_permission('suggestions.read') $$,
  '42501',
  null,
  'anonymous callers cannot execute member_has_permission'
);

select throws_ok(
  $$ select public.get_suggestions_overview() $$,
  '42501',
  null,
  'anonymous callers cannot execute get_suggestions_overview'
);

select throws_ok(
  $$ select public.create_suggestion_draft(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Anon draft',
    'problem',
    'idea'
  ) $$,
  '42501',
  null,
  'anonymous callers cannot create suggestion drafts'
);

select throws_ok(
  $$ select public.award_recognition(
    '00000000-0000-0000-0000-000000000001',
    'Anon award',
    'message',
    '00000000-0000-0000-0000-000000000002',
    'organisation',
    array['00000000-0000-0000-0000-000000000003']::uuid[],
    null,
    null
  ) $$,
  '42501',
  null,
  'anonymous callers cannot award recognition'
);

select throws_ok(
  $$ select public.get_workforce_provision_intent_for_worker(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ) $$,
  '42501',
  null,
  'anonymous callers cannot read workforce provision worker intents'
);

select throws_ok(
  $$ select public.accept_organisation_invitation(decode(repeat('ff', 32), 'hex')) $$,
  '42501',
  null,
  'anonymous callers cannot accept invitations'
);

select is(
  public.preview_organisation_invitation(decode(repeat('ff', 32), 'hex')) ->> 'state',
  'invalid',
  'anonymous preview of an unknown token stays non-enumerating'
);

reset role;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'sec-rpc-owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'sec-rpc-owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'sec-rpc-invitee@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table sec_rpc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on sec_rpc_ids to authenticated, anon, service_role;

insert into sec_rpc_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'c1000000-0000-0000-0000-000000000001',
      'sec-rpc-org-a',
      'SEC RPC Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'c1000000-0000-0000-0000-000000000002',
      'sec-rpc-org-b',
      'SEC RPC Org B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

update private.identity_controls
set
  status = 'active',
  enrolment_status = 'complete',
  enrolment_completed_at = statement_timestamp()
where user_id = 'c1000000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"sec-rpc-owner-a@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_ids where key = 'org_a')),
  'owner A can still switch organisation after EXECUTE revokes'
);

select ok(
  public.member_has_permission('workforce.provision'),
  'authenticated permission probe still works after anon revoke'
);

select ok(
  jsonb_typeof(public.get_suggestions_overview()) = 'object',
  'authenticated suggestions overview still executes for the selected tenant'
);

insert into sec_rpc_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from sec_rpc_ids where key = 'org_a'),
  null,
  'sec-rpc-root',
  'SEC RPC Root',
  'site'
);

insert into sec_rpc_ids (key, id)
select 'job_function', public.create_job_function('SEC RPC Operator', 'sec-rpc-operator');

insert into sec_rpc_ids (key, id)
select 'member_role_draft', public.create_role_draft(
  (select id from sec_rpc_ids where key = 'org_a'),
  'sec-rpc-member',
  'SEC RPC Member',
  'Delegatable member role for SEC-RPC-001'
);

select ok(
  public.add_role_permission(
    (select id from sec_rpc_ids where key = 'org_a'),
    (select id from sec_rpc_ids where key = 'member_role_draft'),
    'hierarchy.read'
  ),
  'owner A can still grant a role permission'
);

select ok(
  public.publish_role_version(
    (select id from sec_rpc_ids where key = 'org_a'),
    (select id from sec_rpc_ids where key = 'member_role_draft')
  ),
  'owner A can still publish a role version'
);

insert into sec_rpc_ids (key, id)
select 'member_role_version', id
from sec_rpc_ids
where key = 'member_role_draft';

insert into sec_rpc_ids (key, id)
select
  'invitation',
  public.issue_organisation_member_invitation(
    'email',
    'sec-rpc-invitee@example.test',
    decode(repeat('ab', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from sec_rpc_ids where key = 'member_role_version'),
    'organisation',
    null,
    'SEC RPC Invitee',
    (select id from sec_rpc_ids where key = 'job_function'),
    (select id from sec_rpc_ids where key = 'root_unit')
  );

select ok(
  (select id is not null from sec_rpc_ids where key = 'invitation'),
  'owner A can still issue a member invitation'
);

select throws_ok(
  $$ select public.get_workforce_provision_intent_for_worker(
    '00000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001'
  ) $$,
  '42501',
  null,
  'authenticated members cannot execute the workforce provision worker RPC'
);

reset role;
set local role anon;

select is(
  public.preview_organisation_invitation(decode(repeat('ab', 32), 'hex')) ->> 'state',
  'valid',
  'anonymous invitation preview still works after EXECUTE revokes'
);

select is(
  public.preview_organisation_invitation(decode(repeat('ab', 32), 'hex')) ->> 'organisation_name',
  'SEC RPC Org A',
  'anonymous invitation preview still returns permitted organisation name'
);

select ok(
  public.prepare_organisation_invitation_signup_binding(decode(repeat('ab', 32), 'hex'))
    is not null,
  'anonymous invitation signup binding still works'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000002","email":"sec-rpc-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_ids where key = 'org_b')),
  'owner B can switch into the second organisation'
);

select ok(
  jsonb_typeof(public.get_suggestions_overview()) = 'object',
  'owner B suggestions overview still executes for the selected tenant'
);

select is(
  public.switch_organisation((select id from sec_rpc_ids where key = 'org_a')),
  false,
  'owner B cannot switch into organisation A'
);

select is(
  public.current_organisation_id(),
  (select id from sec_rpc_ids where key = 'org_b'),
  'owner B remains in organisation B after the rejected switch'
);

select is(
  (select count(*) from public.organisations),
  1::bigint,
  'selected tenant limits organisation visibility'
);

select is(
  (select code from public.organisations),
  'sec-rpc-org-b',
  'owner B cannot read organisation A through RLS'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.get_workforce_provision_intent_for_worker(
      '00000000-0000-0000-0000-000000000001',
      'c1000000-0000-0000-0000-000000000001'
    )
  ),
  0::bigint,
  'service_role can execute the worker RPC and receives no unmatched intent'
);

select * from finish();

rollback;
