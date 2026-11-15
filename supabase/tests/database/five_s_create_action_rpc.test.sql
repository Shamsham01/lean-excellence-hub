begin;

select plan(14);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'five-s-action-rpc@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f5000000-0000-0000-0000-000000000002',
    'five-s-action-team-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table five_s_action_rpc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on five_s_action_rpc_ids to authenticated;

insert into five_s_action_rpc_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f5000000-0000-0000-0000-000000000001',
    'five-s-action-rpc-org',
    'Five S Action RPC Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f5100000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f5100000-0000-0000-0000-000000000002',
    'f5000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values (
  (select id from five_s_action_rpc_ids where key = 'organisation'),
  'f5000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'f5000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"f5000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f5100000-0000-0000-0000-000000000001","email":"five-s-action-rpc@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from five_s_action_rpc_ids where key = 'organisation')),
  'organisation selected'
);

insert into five_s_action_rpc_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from five_s_action_rpc_ids where key = 'organisation'),
  null,
  'five-s-action-unit',
  'Five S Action Unit',
  'site'
);

insert into five_s_action_rpc_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from five_s_action_rpc_ids where key = 'organisation')
  and membership_row.user_id = 'f5000000-0000-0000-0000-000000000001';

insert into five_s_action_rpc_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Action RPC Standard',
  'Planner action coverage',
  90
);

insert into five_s_action_rpc_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from five_s_action_rpc_ids where key = 'standard')
  and version_row.version_number = 1;

insert into five_s_action_rpc_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from five_s_action_rpc_ids where key = 'version'),
  'Sort',
  1
);

insert into five_s_action_rpc_ids (key, id)
select 'question', public.add_five_s_question(
  target_standard_version_id := (select id from five_s_action_rpc_ids where key = 'version'),
  target_section_id := (select id from five_s_action_rpc_ids where key = 'section'),
  target_question_type := 'yes_no',
  target_prompt := 'Area acceptable?',
  target_position := 1,
  target_is_required := true
);

select public.set_five_s_standard_applicable_units(
  (select id from five_s_action_rpc_ids where key = 'standard'),
  array[(select id from five_s_action_rpc_ids where key = 'unit')]
);

select ok(
  public.publish_five_s_standard_version((select id from five_s_action_rpc_ids where key = 'version')),
  'standard published'
);

insert into five_s_action_rpc_ids (key, id)
select 'audit', public.start_five_s_audit(
  (select id from five_s_action_rpc_ids where key = 'standard'),
  (select id from five_s_action_rpc_ids where key = 'unit')
);

insert into five_s_action_rpc_ids (key, id)
select 'action_idem', public.create_five_s_action(
  '5S corrective action',
  (select id from five_s_action_rpc_ids where key = 'audit'),
  (select id from five_s_action_rpc_ids where key = 'owner_membership'),
  statement_timestamp() + interval '5 days',
  'f5100000-0000-0000-0000-000000000099',
  (select id from five_s_action_rpc_ids where key = 'section'),
  (select id from five_s_action_rpc_ids where key = 'question')
);

select is(
  public.create_five_s_action(
    '5S corrective action replay',
    (select id from five_s_action_rpc_ids where key = 'audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '5 days',
    'f5100000-0000-0000-0000-000000000099',
    (select id from five_s_action_rpc_ids where key = 'section'),
    (select id from five_s_action_rpc_ids where key = 'question')
  ),
  (select id from five_s_action_rpc_ids where key = 'action_idem'),
  'create_five_s_action idempotency replay returns the same action'
);

select throws_ok(
  format(
    'select public.create_five_s_action(%L, %L::uuid, %L::uuid, null, %L)',
    '5S action missing due date',
    (select id from five_s_action_rpc_ids where key = 'audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    'f5100000-0000-0000-0000-000000000001'
  ),
  '22023',
  '5S actions require a due date',
  'create_five_s_action requires due date'
);

select throws_ok(
  format(
    'select public.create_five_s_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    '5S action missing idempotency key',
    (select id from five_s_action_rpc_ids where key = 'audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '1 day',
    '   '
  ),
  '22023',
  '5S actions require an idempotency key',
  'create_five_s_action rejects empty idempotency key'
);

select throws_ok(
  format(
    'select private.create_five_s_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Denied private 5S action',
    (select id from five_s_action_rpc_ids where key = 'audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '2 days',
    'f5100000-0000-0000-0000-000000000002'
  ),
  '42501',
  'permission denied for function create_five_s_action',
  'authenticated cannot execute private create_five_s_action'
);

insert into five_s_action_rpc_ids (key, id)
select 'second_audit', public.start_five_s_audit(
  (select id from five_s_action_rpc_ids where key = 'standard'),
  (select id from five_s_action_rpc_ids where key = 'unit')
);

insert into five_s_action_rpc_ids (key, id)
select 'first_audit_finding', public.create_five_s_finding(
  (select id from five_s_action_rpc_ids where key = 'audit'),
  'Foreign finding body',
  (select id from five_s_action_rpc_ids where key = 'section'),
  (select id from five_s_action_rpc_ids where key = 'question'),
  'low',
  'normal',
  false
);

select throws_ok(
  format(
    'select public.create_five_s_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L, %L::uuid, %L::uuid, %L::uuid)',
    '5S action with finding from another audit',
    (select id from five_s_action_rpc_ids where key = 'second_audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '6 days',
    'f5100000-0000-0000-0000-0000000000b1',
    (select id from five_s_action_rpc_ids where key = 'section'),
    (select id from five_s_action_rpc_ids where key = 'question'),
    (select id from five_s_action_rpc_ids where key = 'first_audit_finding')
  ),
  'P0002',
  '5S finding was not found on this audit',
  'create_five_s_action refuses finding from another audit'
);

select throws_ok(
  format(
    'select public.create_five_s_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    '5S audit mismatch replay',
    (select id from five_s_action_rpc_ids where key = 'second_audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '6 days',
    'f5100000-0000-0000-0000-000000000099'
  ),
  '23505',
  '5S action idempotency key reuse mismatch',
  'create_five_s_action rejects idempotency replay on a different audit'
);

select ok(
  exists (
    select 1
    from public.actions action_row
    where action_row.id = (select id from five_s_action_rpc_ids where key = 'action_idem')
      and action_row.idempotency_key = format(
        'five_s:%s:f5100000-0000-0000-0000-000000000099',
        (select id from five_s_action_rpc_ids where key = 'owner_membership')
      )
  ),
  'create_five_s_action stores namespaced idempotency keys'
);

insert into five_s_action_rpc_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from five_s_action_rpc_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into five_s_action_rpc_ids (key, id)
select 'team_member_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from five_s_action_rpc_ids where key = 'organisation')
  and membership_row.user_id = 'f5000000-0000-0000-0000-000000000002';

select ok(
  public.grant_role_version(
    (select id from five_s_action_rpc_ids where key = 'organisation'),
    (select id from five_s_action_rpc_ids where key = 'team_member_membership'),
    (select id from five_s_action_rpc_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from five_s_action_rpc_ids where key = 'unit')
  ) is not null,
  'team member receives unit-scoped team-member role for 5S planner test'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f5000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f5100000-0000-0000-0000-000000000002","email":"five-s-action-team-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from five_s_action_rpc_ids where key = 'organisation')),
  'team member selects organisation for 5S planner test'
);

insert into five_s_action_rpc_ids (key, id)
select 'team_member_action', public.create_five_s_action(
  'Team member 5S corrective action',
  (select id from five_s_action_rpc_ids where key = 'audit'),
  (select id from five_s_action_rpc_ids where key = 'team_member_membership'),
  statement_timestamp() + interval '8 days',
  'f5100000-0000-0000-0000-0000000000c1'
);

select is(
  (
    select assignee_row.membership_id::text
    from public.action_assignees assignee_row
    where assignee_row.organisation_id = (select id from five_s_action_rpc_ids where key = 'organisation')
      and assignee_row.action_id = (select id from five_s_action_rpc_ids where key = 'team_member_action')
  ),
  (select id::text from five_s_action_rpc_ids where key = 'team_member_membership'),
  'team member create_five_s_action self-assign sets creator as assignee'
);

select throws_ok(
  format(
    'select public.create_five_s_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Team member other assign denied',
    (select id from five_s_action_rpc_ids where key = 'audit'),
    (select id from five_s_action_rpc_ids where key = 'owner_membership'),
    statement_timestamp() + interval '9 days',
    'f5100000-0000-0000-0000-0000000000c2'
  ),
  '42501',
  'action assignment is not authorised',
  'team member create_five_s_action refuses assignee without actions.assign'
);

select is(
  (
    select count(*)::integer
    from public.actions action_row
    where action_row.organisation_id = (select id from five_s_action_rpc_ids where key = 'organisation')
      and action_row.idempotency_key = format(
        'five_s:%s:f5100000-0000-0000-0000-0000000000c2',
        (select id::text from five_s_action_rpc_ids where key = 'team_member_membership')
      )
  ),
  0,
  'denied team member 5S action assign leaves no action row'
);

select * from finish();
rollback;