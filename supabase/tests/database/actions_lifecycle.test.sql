begin;

select plan(20);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'action-lifecycle-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'action-lifecycle-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'action-lifecycle-manager@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on lifecycle_ids to authenticated;

insert into lifecycle_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd1000000-0000-0000-0000-000000000001',
    'action-lifecycle-org',
    'Action Lifecycle Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'd1100000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd1100000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd1100000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at, display_name
)
values
  (
    (select id from lifecycle_ids where key = 'organisation'),
    'd1000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'Lifecycle Member'
  ),
  (
    (select id from lifecycle_ids where key = 'organisation'),
    'd1000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp(),
    'Lifecycle Manager'
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'd1000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000003'
);

insert into lifecycle_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000001';

insert into lifecycle_ids (key, id)
select 'member_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000002';

insert into lifecycle_ids (key, id)
select 'manager_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and membership_row.user_id = 'd1000000-0000-0000-0000-000000000003';

insert into lifecycle_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into lifecycle_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d1100000-0000-0000-0000-000000000001","email":"action-lifecycle-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into lifecycle_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from lifecycle_ids where key = 'organisation'),
  null,
  'lifecycle-site',
  'Lifecycle Site',
  'site'
);

insert into lifecycle_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from lifecycle_ids where key = 'organisation'),
  (select id from lifecycle_ids where key = 'site'),
  'lifecycle-child',
  'Lifecycle Child',
  'department'
);

insert into lifecycle_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from lifecycle_ids where key = 'organisation'),
  (select id from lifecycle_ids where key = 'site'),
  'lifecycle-sibling',
  'Lifecycle Sibling',
  'department'
);

select ok(
  public.grant_role_version(
    (select id from lifecycle_ids where key = 'organisation'),
    (select id from lifecycle_ids where key = 'member_membership'),
    (select id from lifecycle_ids where key = 'team_member_role_version'),
    'self',
    null
  ) is not null,
  'owner grants team member self-scoped role'
);

select ok(
  public.grant_role_version(
    (select id from lifecycle_ids where key = 'organisation'),
    (select id from lifecycle_ids where key = 'manager_membership'),
    (select id from lifecycle_ids where key = 'manager_role_version'),
    'unit_subtree',
    (select id from lifecycle_ids where key = 'child_unit')
  ) is not null,
  'owner grants manager role on child unit only'
);

insert into lifecycle_ids (key, id)
select 'action', public.create_action(
  'Lifecycle action',
  'Owner created action',
  'high',
  (select id from lifecycle_ids where key = 'sibling_unit'),
  null,
  statement_timestamp() + interval '7 days',
  'lifecycle-action-key'
);

select ok(
  (select action_number from public.actions where id = (select id from lifecycle_ids where key = 'action'))
    is not null,
  'created action receives a human-readable number'
);

select ok(
  public.update_action(
    (select id from lifecycle_ids where key = 'action'),
    'Lifecycle action updated',
    'Updated description',
    'urgent',
    statement_timestamp() + interval '3 days',
    false,
    1
  ),
  'owner can update editable fields'
);

select is(
  (select title from public.actions where id = (select id from lifecycle_ids where key = 'action')),
  'Lifecycle action updated',
  'updated title persists'
);

select throws_ok(
  format(
    'select public.update_action(%L::uuid, %L, null, null, null, false, 1)',
    (select id from lifecycle_ids where key = 'action'),
    'Stale title'
  ),
  '55000',
  'action changed since you opened it',
  'stale expected version is rejected'
);

select ok(
  public.transition_action_status(
    (select id from lifecycle_ids where key = 'action'),
    'in_progress',
    null,
    2
  ),
  'open to in progress succeeds'
);

select throws_ok(
  format(
    'select public.transition_action_status(%L::uuid, %L)',
    (select id from lifecycle_ids where key = 'action'),
    'verified'
  ),
  '22023',
  null,
  'invalid status is rejected server-side'
);

select ok(
  public.complete_action(
    (select id from lifecycle_ids where key = 'action'),
    'Done on the floor',
    3
  ),
  'valid completion succeeds'
);

select ok(
  (
    select action_row.completed_at is not null
      and action_row.status = 'completed'
    from public.actions action_row
    where action_row.id = (select id from lifecycle_ids where key = 'action')
  ),
  'completion records completed_at and status'
);

select ok(
  exists (
    select 1
    from public.action_status_transitions transition_row
    where transition_row.action_id = (select id from lifecycle_ids where key = 'action')
      and transition_row.from_status = 'in_progress'
      and transition_row.to_status = 'completed'
      and transition_row.actor_membership_id = (select id from lifecycle_ids where key = 'owner_membership')
      and transition_row.reason = 'Done on the floor'
  ),
  'completion history records actor, from/to status, and reason'
);

select throws_ok(
  format(
    'select public.transition_action_status(%L::uuid, %L)',
    (select id from lifecycle_ids where key = 'action'),
    'in_progress'
  ),
  '55000',
  'action transition is not allowed',
  'completed cannot move to in progress without reopen'
);

select ok(
  public.reopen_action((select id from lifecycle_ids where key = 'action')),
  'reopen from completed succeeds'
);

select is(
  (select status from public.actions where id = (select id from lifecycle_ids where key = 'action')),
  'open',
  'reopened action returns to open'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d1100000-0000-0000-0000-000000000002","email":"action-lifecycle-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation')),
  'scoped member selects organisation'
);

select throws_ok(
  format(
    'select public.get_action_detail(%L::uuid)',
    (select id from lifecycle_ids where key = 'action')
  ),
  '42501',
  'action detail is not authorised',
  'self-scoped member cannot read an unassigned action outside their authority'
);

select throws_ok(
  format(
    'select public.update_action(%L::uuid, %L)',
    (select id from lifecycle_ids where key = 'action'),
    'Hijacked title'
  ),
  '42501',
  'action update is not authorised',
  'self-scoped member cannot update an action outside delegated scope'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d1100000-0000-0000-0000-000000000003","email":"action-lifecycle-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation')),
  'unit-scoped manager selects organisation'
);

select throws_ok(
  format(
    'select public.complete_action(%L::uuid)',
    (select id from lifecycle_ids where key = 'action')
  ),
  '42501',
  'action transition is not authorised',
  'child-unit manager cannot complete a sibling-unit action; active site is not consulted'
);

select * from finish();
rollback;
