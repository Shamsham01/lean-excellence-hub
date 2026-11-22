begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd3100000-0000-4000-8000-0000000000aa',
    'platform-operator-inapp@leh.example',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd3100000-0000-4000-8000-0000000000a1',
    'tenant-owner-inapp@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into private.platform_admins (auth_user_id, label, bootstrap_note)
values (
  'd3100000-0000-4000-8000-0000000000aa',
  'Platform operator',
  'pgTAP in-app fixture'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.platform_admin_in_app_notifications(uuid, text, text, integer)',
    'execute'
  ),
  false,
  'authenticated cannot list platform owner in-app notifications'
);

select is(
  has_function_privilege(
    'anon',
    'public.platform_admin_in_app_notifications(uuid, text, text, integer)',
    'execute'
  ),
  false,
  'anon cannot list platform owner in-app notifications'
);

select throws_ok(
  $$select public.platform_admin_in_app_notifications(
    'd3100000-0000-4000-8000-0000000000a1',
    'aal2',
    '/org_admin',
    20
  )$$,
  '42501',
  'platform admin access is not authorised',
  'tenant user cannot read platform in-app notifications'
);

set local role authenticated;

select throws_ok(
  $$select * from private.platform_admin_in_app_notifications$$,
  '42501',
  null,
  'authenticated cannot read platform admin in-app notification table'
);

reset role;

select ok(
  exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'cron'
      and proc.proname = 'schedule'
  ),
  'pg_cron is available for scheduler migration'
);

select ok(
  exists (
    select 1
    from cron.job job
    where job.jobname = 'leh_platform_notification_delivery_every_minute'
  ),
  'platform notification delivery cron job is scheduled'
);

select ok(
  private.enqueue_platform_notification(
    'organisation.founded',
    'pgtap.inapp.organisation.founded:fixture',
    null,
    'fixture-source',
    jsonb_build_object(
      'organisation_name', 'In-App Fixture Org',
      'organisation_code', 'inapp-fixture',
      'email', 'founder@harbourfieldfoods.co.uk'
    )
  ) is not null,
  'enqueue creates a platform notification event'
);

select ok(
  exists (
    select 1
    from private.platform_admin_in_app_notifications notification_row
    where notification_row.auth_user_id = 'd3100000-0000-4000-8000-0000000000aa'
      and notification_row.title = 'Organisation founded'
      and notification_row.read_at is null
  ),
  'active platform admin receives an in-app alert for a queued event'
);

select ok(
  not exists (
    select 1
    from private.platform_admin_in_app_notifications notification_row
    where notification_row.auth_user_id = 'd3100000-0000-4000-8000-0000000000a1'
  ),
  'non-admin identities do not receive in-app alerts'
);

select is(
  (
    public.platform_admin_in_app_notifications(
      'd3100000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin',
      20
    ) ->> 'unread_count'
  )::integer,
  1,
  'platform admin in-app RPC returns unread count'
);

select ok(
  public.mark_platform_admin_in_app_notification_read(
    'd3100000-0000-4000-8000-0000000000aa',
    'aal2',
    (
      select notification_row.id
      from private.platform_admin_in_app_notifications notification_row
      where notification_row.auth_user_id = 'd3100000-0000-4000-8000-0000000000aa'
      limit 1
    )
  ),
  'platform admin can mark one in-app notification read'
);

select is(
  (
    public.platform_admin_in_app_notifications(
      'd3100000-0000-4000-8000-0000000000aa',
      'aal2',
      '/org_admin',
      20
    ) ->> 'unread_count'
  )::integer,
  0,
  'unread count drops after mark read'
);

select throws_ok(
  $$select public.mark_platform_admin_in_app_notification_read(
    'd3100000-0000-4000-8000-0000000000a1',
    'aal2',
    '00000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'platform admin access is not authorised',
  'tenant user cannot mark platform in-app notifications'
);

select * from finish();

rollback;
