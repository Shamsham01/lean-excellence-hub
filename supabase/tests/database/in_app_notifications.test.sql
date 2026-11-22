begin;

select plan(14);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c3410000-0000-4000-8000-000000000001',
    'inapp-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c3410000-0000-4000-8000-000000000002',
    'inapp-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table inapp_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on inapp_ids to authenticated, lean_hub_private_owner;

insert into inapp_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c3410000-0000-4000-8000-000000000001',
    'inapp-org',
    'In-app notifications org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c3411000-0000-4000-8000-000000000001',
    'c3410000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c3411000-0000-4000-8000-000000000002',
    'c3410000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from inapp_ids where key = 'organisation'),
    'c3410000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active', enrolment_status = 'complete', enrolment_completed_at = statement_timestamp()
where user_id = 'c3410000-0000-4000-8000-000000000002';

insert into inapp_ids (key, id)
select 'owner_membership', id
from public.organisation_memberships
where organisation_id = (select id from inapp_ids where key = 'organisation')
  and user_id = 'c3410000-0000-4000-8000-000000000001';

insert into inapp_ids (key, id)
select 'member_membership', id
from public.organisation_memberships
where organisation_id = (select id from inapp_ids where key = 'organisation')
  and user_id = 'c3410000-0000-4000-8000-000000000002';

select ok(
  pg_catalog.has_table_privilege('authenticated', 'public.in_app_notifications', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.in_app_notifications', 'INSERT')
  and pg_catalog.has_table_privilege('authenticated', 'public.in_app_notifications', 'UPDATE'),
  'authenticated read/update in_app_notifications only (no direct insert)'
);

set local role lean_hub_private_owner;

select lives_ok(
  format(
    $$insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    ) values (
      %L::uuid,
      %L::uuid,
      'test.visibility',
      'Hello',
      'Body',
      '/platform',
      'test:dedupe:1'
    )$$,
    (select id from inapp_ids where key = 'organisation'),
    (select id from inapp_ids where key = 'owner_membership')
  ),
  'private owner can seed a notification row'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3410000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3411000-0000-4000-8000-000000000001","email":"inapp-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from inapp_ids where key = 'organisation')),
  'owner selects organisation'
);

select is(
  (
    select count(*)
    from public.in_app_notifications
    where membership_id = (select id from inapp_ids where key = 'owner_membership')
  ),
  1::bigint,
  'owner can read own notifications'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c3411000-0000-4000-8000-000000000002","email":"inapp-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from inapp_ids where key = 'organisation')),
  'peer member selects organisation'
);

select is(
  (
    select count(*)
    from public.in_app_notifications
  ),
  0::bigint,
  'peer member cannot read owner notification rows (RLS)'
);

reset role;

set local role lean_hub_private_owner;

select is(
  (
    select private.insert_membership_in_app_notification(
      (select id from inapp_ids where key = 'organisation'),
      (select id from inapp_ids where key = 'owner_membership'),
      'test.dedupe',
      'First title',
      'First body',
      '/platform',
      'test:dedupe:upsert'
    )::text
  ),
  (
    select private.insert_membership_in_app_notification(
      (select id from inapp_ids where key = 'organisation'),
      (select id from inapp_ids where key = 'owner_membership'),
      'test.dedupe',
      'Second title',
      'Second body',
      '/platform/suggestions',
      'test:dedupe:upsert'
    )::text
  ),
  'dedupe upsert returns stable row id'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3410000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c3411000-0000-4000-8000-000000000001","email":"inapp-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from inapp_ids where key = 'organisation')),
  'owner selects organisation for dedupe reads'
);

select is(
  (
    select count(*)
    from public.in_app_notifications
    where membership_id = (select id from inapp_ids where key = 'owner_membership')
      and dedupe_key = 'test:dedupe:upsert'
  ),
  1::bigint,
  'dedupe key collapses to one row'
);

select is(
  (
    select title
    from public.in_app_notifications
    where membership_id = (select id from inapp_ids where key = 'owner_membership')
      and dedupe_key = 'test:dedupe:upsert'
  ),
  'Second title',
  'second insert refreshes title on conflict'
);

select ok(
  public.mark_in_app_notification_read(
    (
      select id
      from public.in_app_notifications
      where dedupe_key = 'test:dedupe:upsert'
      limit 1
    )
  ),
  'owner can mark notification read'
);

select ok(
  (
    select read_at is not null
    from public.in_app_notifications
    where dedupe_key = 'test:dedupe:upsert'
  ),
  'read_at populated after mark read'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c3410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c3411000-0000-4000-8000-000000000002","email":"inapp-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from inapp_ids where key = 'organisation')),
  'peer member selects organisation for mark read check'
);

select ok(
  not public.mark_in_app_notification_read(
    (
      select id
      from public.in_app_notifications
      where dedupe_key = 'test:dedupe:upsert'
      limit 1
    )
  ),
  'peer member cannot mark another membership notification read'
);

select * from finish();

rollback;
