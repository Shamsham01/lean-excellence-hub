begin;

select plan(14);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c3412000-0000-4000-8000-000000000001',
    'chase341-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c3412000-0000-4000-8000-000000000002',
    'chase341-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table chase341_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on chase341_ids to authenticated, lean_hub_private_owner;

insert into chase341_ids (key, id)
values (
  'org_a',
  private.provision_organisation(
    'c3412000-0000-4000-8000-000000000001',
    'chase341-org-a',
    'Chase scheduler org A'
  )
);

insert into chase341_ids (key, id)
values (
  'org_b',
  private.provision_organisation(
    'c3412000-0000-4000-8000-000000000002',
    'chase341-org-b',
    'Chase scheduler org B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c3412100-0000-4000-8000-000000000001',
    'c3412000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c3412100-0000-4000-8000-000000000002',
    'c3412000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

insert into chase341_ids (key, id)
select 'membership_a', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from chase341_ids where key = 'org_a')
  and membership_row.user_id = 'c3412000-0000-4000-8000-000000000001';

insert into chase341_ids (key, id)
select 'membership_b', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from chase341_ids where key = 'org_b')
  and membership_row.user_id = 'c3412000-0000-4000-8000-000000000002';

select ok(
  not has_function_privilege(
    'authenticated',
    'private.run_in_app_operational_chase_sync_for_actor(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.run_in_app_operational_chase_sync_for_actor'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.invoke_in_app_operational_chase_worker()',
    'EXECUTE'
  ),
  'authenticated cannot execute private.invoke_in_app_operational_chase_worker'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.insert_membership_in_app_notification(uuid,uuid,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute private.insert_membership_in_app_notification'
);

-- Overdue action in org A for scheduler idempotency
select set_config(
  'request.jwt.claims',
  '{"sub":"c3412000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3412100-0000-4000-8000-000000000001","email":"chase341-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from chase341_ids where key = 'org_a')),
  'org A selected'
);

insert into chase341_ids (key, id)
select 'unit_a', public.create_organisation_unit(
  (select id from chase341_ids where key = 'org_a'),
  null,
  'chase-site-a',
  'Chase Site A',
  'site'
);

insert into chase341_ids (key, id)
select 'overdue_action', public.create_action(
  'Scheduler chase action',
  'Issue 341 worker idempotency',
  'normal',
  (select id from chase341_ids where key = 'unit_a'),
  null,
  null,
  'chase341-worker-action'
);

select ok(
  public.update_action(
    (select id from chase341_ids where key = 'overdue_action'),
    'Scheduler chase action',
    'Issue 341 worker idempotency',
    'normal',
    clock_timestamp() - interval '3 days',
    false,
    1
  ),
  'action backdated overdue'
);

select ok(
  public.set_action_assignee(
    (select id from chase341_ids where key = 'overdue_action'),
    (select id from chase341_ids where key = 'membership_a')
  ),
  'assignee set on overdue action'
);

reset role;
set local role postgres;

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase341_ids where key = 'org_a'),
    (select id from chase341_ids where key = 'membership_a')
  ),
  '>=',
  1,
  'first chase sync creates overdue row'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from chase341_ids where key = 'org_a')
      and notification_row.membership_id = (select id from chase341_ids where key = 'membership_a')
      and notification_row.notification_type = 'leanai.chase_overdue_action'
  ),
  1::bigint,
  'single overdue chase row exists'
);

select cmp_ok(
  private.run_in_app_operational_chase_sync_for_actor(
    (select id from chase341_ids where key = 'org_a'),
    (select id from chase341_ids where key = 'membership_a')
  ),
  '>=',
  0,
  'second chase sync is safe (deduped)'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications notification_row
    where notification_row.organisation_id = (select id from chase341_ids where key = 'org_a')
      and notification_row.membership_id = (select id from chase341_ids where key = 'membership_a')
      and notification_row.notification_type = 'leanai.chase_overdue_action'
  ),
  1::bigint,
  'repeated scheduler run does not duplicate chase'
);

select cmp_ok(
  private.invoke_in_app_operational_chase_worker(),
  '>=',
  0,
  'operational chase worker invocation succeeds'
);

reset role;
set local role lean_hub_private_owner;

insert into chase341_ids (key, id)
select 'chase_notif_a', notification_row.id
from public.in_app_notifications notification_row
where notification_row.organisation_id = (select id from chase341_ids where key = 'org_a')
  and notification_row.notification_type = 'leanai.chase_overdue_action'
limit 1;

-- Cross-org read isolation (org B cannot see org A notification)
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3412000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c3412100-0000-4000-8000-000000000002","email":"chase341-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from chase341_ids where key = 'org_b')),
  'org B selected'
);

select is(
  (
    select count(*)::bigint
    from public.in_app_notifications
  ),
  0::bigint,
  'org B member cannot see org A chase notifications'
);

select ok(
  not public.mark_in_app_notification_read(
    (select id from chase341_ids where key = 'chase_notif_a')
  ),
  'org B member cannot mark org A notification read'
);

select * from finish();

rollback;
