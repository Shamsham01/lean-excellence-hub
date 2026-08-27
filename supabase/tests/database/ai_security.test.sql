begin;

select plan(17);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1500000-0000-0000-0000-000000000001',
  'ai-security-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1500000-0000-0000-0000-000000000002',
  'ai-security-scoped@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1500000-0000-0000-0000-000000000003',
  'ai-security-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1500000-0000-0000-0000-000000000004',
  'ai-security-unprivileged@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ai_security_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ai_security_ids to authenticated;

insert into ai_security_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1500000-0000-0000-0000-000000000001',
    'ai-security-org',
    'AI Security Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1510000-0000-0000-0000-000000000001',
  'a1500000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1510000-0000-0000-0000-000000000002',
  'a1500000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a1510000-0000-0000-0000-000000000003',
  'a1500000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'a1510000-0000-0000-0000-000000000004',
  'a1500000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ai-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation')),
  'owner selects organisation'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'organisation-scoped ai.manage_settings permits settings update'
);

insert into ai_security_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ai_security_ids where key = 'organisation'),
  null,
  'ai-security-site',
  'AI Security Site',
  'site'
);

insert into ai_security_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'AI security case',
  (select id from ai_security_ids where key = 'unit_root'),
  'Cross-tenant ai session leak test'
);

insert into ai_security_ids (key, id)
select 'ai_session', public.create_ai_session(
  (select id from ai_security_ids where key = 'case'),
  'ask'
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
    (select id from ai_security_ids where key = 'organisation'),
    'a1500000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ai_security_ids (key, id)
select 'scoped_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1500000-0000-0000-0000-000000000002';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from ai_security_ids where key = 'organisation'),
    'a1500000-0000-0000-0000-000000000004',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into ai_security_ids (key, id)
select 'unprivileged_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a1500000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ai-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation')),
  'owner re-selects organisation for scoped role setup'
);

insert into ai_security_ids (key, id)
select 'settings_manager_role_version', public.create_role_draft(
  (select id from ai_security_ids where key = 'organisation'),
  'ai-settings-unit-manager',
  'AI Settings Unit Manager',
  'Unit-scoped ai.manage_settings for hostile RBAC probe'
);

select ok(
  public.add_role_permission(
    (select id from ai_security_ids where key = 'organisation'),
    (select id from ai_security_ids where key = 'settings_manager_role_version'),
    'ai.manage_settings'
  ),
  'unit manager role receives ai.manage_settings'
);

select ok(
  public.publish_role_version(
    (select id from ai_security_ids where key = 'organisation'),
    (select id from ai_security_ids where key = 'settings_manager_role_version')
  ),
  'unit manager role publishes'
);

insert into ai_security_ids (key, id)
select 'settings_manager_grant', public.grant_role_version(
  (select id from ai_security_ids where key = 'organisation'),
  (select id from ai_security_ids where key = 'scoped_membership'),
  (select id from ai_security_ids where key = 'settings_manager_role_version'),
  'unit_subtree',
  (select id from ai_security_ids where key = 'unit_root')
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000002","email":"ai-security-scoped@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation')),
  'unit-scoped manager selects organisation'
);

select throws_ok(
  $$select public.update_organisation_ai_settings(true, 50000)$$,
  '42501',
  'ai settings update is not authorised',
  'unit_subtree ai.manage_settings cannot update organisation-wide settings'
);

select ok(
  not exists (
    select 1
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id =
      (select id from ai_security_ids where key = 'organisation')
  ),
  'unit_subtree ai.manage_settings cannot read organisation-wide settings'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000004","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000004","email":"ai-security-unprivileged@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation')),
  'unprivileged member selects organisation'
);

select throws_ok(
  $$select public.update_organisation_ai_settings(true, 50000)$$,
  '42501',
  'ai settings update is not authorised',
  'member without ai.manage_settings cannot update organisation-wide settings'
);

reset role;

insert into ai_security_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'a1500000-0000-0000-0000-000000000003',
    'ai-security-org-b',
    'AI Security Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000003","email":"ai-security-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select ok(
  not exists (
    select 1
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id =
      (select id from ai_security_ids where key = 'organisation')
  ),
  'cross-tenant actor cannot read other organisation ai settings'
);

select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from ai_security_ids where key = 'ai_session')
  ),
  '42501',
  'ai session read is not authorised',
  'outsider cannot read ai session detail across tenants'
);

select ok(
  not exists (
    select 1
    from public.ai_sessions session_row
    where session_row.id = (select id from ai_security_ids where key = 'ai_session')
  ),
  'outsider cannot select ai session row via rls'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ai-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ai_security_ids where key = 'organisation')),
  'owner re-selects organisation for usage append-only check'
);

insert into ai_security_ids (key, id)
select 'ai_run', public.start_ai_run(
  (select id from ai_security_ids where key = 'ai_session'),
  'Usage ledger append-only probe',
  'ai-security-run-1',
  'fake',
  'fake-model',
  'problem_solving_facilitator',
  'v1',
  'hash-sec-1'
);

select ok(
  public.finish_ai_run(
    (select id from ai_security_ids where key = 'ai_run'),
    'Probe response for usage ledger.',
    jsonb_build_object(
      'message', 'Probe response for usage ledger.',
      'observations', '[]'::jsonb,
      'questions', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'source_refs', '[]'::jsonb,
      'proposals', '[]'::jsonb
    ),
    'v1',
    '{}'::jsonb,
    'hash-sec-manifest',
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    5,
    5,
    0,
    0,
    0,
    5
  ) is not null,
  'owner finishes run to create usage ledger row'
);

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_events', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_events', 'DELETE'),
  'usage ledger is not directly mutable by authenticated role'
);

reset role;

select * from finish();
rollback;
