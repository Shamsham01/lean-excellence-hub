begin;

select plan(27);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c3411000-0000-4000-8000-000000000001',
    'slice341-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c3411000-0000-4000-8000-000000000002',
    'slice341-manager@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table slice341_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on slice341_ids to authenticated, lean_hub_private_owner;

insert into slice341_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c3411000-0000-4000-8000-000000000001',
    'slice341-org',
    'In-app emitters slice 341 org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c3411100-0000-4000-8000-000000000001',
    'c3411000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c3411100-0000-4000-8000-000000000002',
    'c3411000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

with inserted as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from slice341_ids where key = 'organisation'),
    'c3411000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into slice341_ids (key, id)
select 'manager_membership', id from inserted;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c3411000-0000-4000-8000-000000000002';

insert into slice341_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from slice341_ids where key = 'organisation')
  and membership_row.user_id = 'c3411000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Catalogue + suggestion (owner authors, manager approves)
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"c3411000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3411100-0000-4000-8000-000000000001","email":"slice341-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from slice341_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into slice341_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from slice341_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into slice341_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select id from slice341_ids where key = 'owner_membership'),
    (select id from slice341_ids where key = 'job_function'),
    true,
    (select id from slice341_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment'
);

insert into slice341_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into slice341_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from slice341_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from slice341_ids where key = 'programme_version')),
  'programme version publishes'
);

insert into slice341_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into slice341_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from slice341_ids where key = 'programme_version'),
  (select id from slice341_ids where key = 'category'),
  'Slice341 emitter suggestion',
  'Problem text',
  'Idea text',
  'Benefit text'
);

insert into slice341_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from slice341_ids where key = 'organisation'),
  'slice341-manager',
  'Slice341 Manager',
  'Manager for in-app emitter tests'
);

select ok(
  public.add_role_permission(
    (select id from slice341_ids where key = 'organisation'),
    (select id from slice341_ids where key = 'manager_role'),
    'suggestions.manage'
  ),
  'manager role receives suggestions.manage'
);

select ok(
  public.add_role_permission(
    (select id from slice341_ids where key = 'organisation'),
    (select id from slice341_ids where key = 'manager_role'),
    'suggestions.review'
  ),
  'manager role receives suggestions.review'
);

select ok(
  public.publish_role_version(
    (select id from slice341_ids where key = 'organisation'),
    (select id from slice341_ids where key = 'manager_role')
  ),
  'manager role publishes'
);

select ok(
  public.grant_role_version(
    (select id from slice341_ids where key = 'organisation'),
    (select id from slice341_ids where key = 'manager_membership'),
    (select id from slice341_ids where key = 'manager_role'),
    'unit_subtree',
    (select id from slice341_ids where key = 'unit_root')
  ) is not null,
  'manager receives scoped grant on root unit'
);

select ok(
  public.assign_membership_job_function(
    (select id from slice341_ids where key = 'manager_membership'),
    (select id from slice341_ids where key = 'job_function'),
    true,
    (select id from slice341_ids where key = 'unit_root')
  ) is not null,
  'owner assigns manager primary job function'
);

select ok(
  public.submit_suggestion((select id from slice341_ids where key = 'suggestion')),
  'owner submits suggestion'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from slice341_ids where key = 'organisation')
      and notification_row.membership_id = (select id from slice341_ids where key = 'manager_membership')
      and notification_row.notification_type = 'suggestions.awaiting_review'
      and notification_row.dedupe_key = (
        'suggestion:'
        || (select id from slice341_ids where key = 'suggestion')::text
        || ':approval:v'
        || (
          select routing_row.notification_generation::text
          from public.suggestion_approval_routing routing_row
          where routing_row.organisation_id = (select id from slice341_ids where key = 'organisation')
            and routing_row.suggestion_id = (select id from slice341_ids where key = 'suggestion')
        )
      )
  ),
  1::bigint,
  'manager receives approval-queue notification when operator/author submits'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from slice341_ids where key = 'organisation')
      and notification_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
      and notification_row.notification_type = 'suggestions.status_submitted'
  ),
  1::bigint,
  'author receives submitted receipt notification'
);

-- Review + approve (manager acts; author gets accepted)
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3411000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c3411100-0000-4000-8000-000000000002","email":"slice341-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from slice341_ids where key = 'organisation')),
  'manager selects organisation'
);

select ok(
  public.claim_suggestion_for_review((select id from slice341_ids where key = 'suggestion')) is not null,
  'manager claims suggestion'
);

select ok(
  public.begin_suggestion_review((select id from slice341_ids where key = 'suggestion')),
  'manager begins review'
);

select ok(
  public.approve_suggestion(
    (select id from slice341_ids where key = 'suggestion'),
    'medium',
    'medium',
    'Internal notes',
    'Approved for test.'
  ) is not null,
  'manager approves suggestion'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from slice341_ids where key = 'organisation')
      and notification_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
      and notification_row.notification_type = 'suggestions.status_accepted'
  ),
  1::bigint,
  'author receives accepted status notification'
);

-- ---------------------------------------------------------------------------
-- Operational chase: overdue action + throttle
-- ---------------------------------------------------------------------------

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3411000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3411100-0000-4000-8000-000000000001","email":"slice341-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from slice341_ids where key = 'organisation')),
  'owner selects organisation for chase sync'
);

insert into slice341_ids (key, id)
select 'overdue_action', public.create_action(
  'Overdue emitter action',
  'Testing LeanAI chase',
  'normal',
  (select id from slice341_ids where key = 'unit_root'),
  null,
  null,
  'slice341-overdue-action'
);

select ok(
  public.update_action(
    (select id from slice341_ids where key = 'overdue_action'),
    'Overdue emitter action',
    'Testing LeanAI chase',
    'normal',
    clock_timestamp() - interval '2 days',
    false,
    1
  ),
  'owner backdates action due date'
);

select ok(
  public.set_action_assignee(
    (select id from slice341_ids where key = 'overdue_action'),
    (select id from slice341_ids where key = 'owner_membership')
  ),
  'owner assigned to overdue action'
);

select is(
  (
    select count(*)::bigint
    from public.action_assignees assignee_row
    where assignee_row.action_id = (select id from slice341_ids where key = 'overdue_action')
      and assignee_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
  ),
  1::bigint,
  'overdue action assignee row exists before sync'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)::bigint
    from public.actions action_row
    join public.action_assignees assignee_row
      on assignee_row.organisation_id = action_row.organisation_id
     and assignee_row.action_id = action_row.id
    where action_row.id = (select id from slice341_ids where key = 'overdue_action')
      and assignee_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
      and action_row.status in ('open', 'in_progress')
      and action_row.due_at is not null
      and action_row.due_at < clock_timestamp()
  ),
  1::bigint,
  'overdue action candidate matches chase query'
);

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from slice341_ids where key = 'organisation'),
    (select id from slice341_ids where key = 'owner_membership')
  ),
  '>=',
  1,
  'operational chase sync upserts overdue action for assignee'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3411000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3411100-0000-4000-8000-000000000001","email":"slice341-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from slice341_ids where key = 'organisation')),
  'owner selects organisation for public chase RPC'
);

select cmp_ok(
  public.sync_leanai_operational_chase_notifications(),
  '>=',
  0,
  'public chase RPC is safe to call after direct sync (throttle may return 0)'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
      and notification_row.notification_type = 'leanai.chase_overdue_action'
  ),
  1::bigint,
  'overdue action deduped to a single chase row'
);

select is(
  public.sync_leanai_operational_chase_notifications(),
  0,
  'immediate second chase sync is rate-limited (no spam)'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.membership_id = (select id from slice341_ids where key = 'owner_membership')
      and notification_row.notification_type = 'leanai.chase_overdue_action'
  ),
  1::bigint,
  'rate limit does not duplicate overdue action rows'
);

select * from finish();

rollback;
