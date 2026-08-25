begin;

select plan(3);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in (
      'schedules.read',
      'schedules.manage',
      'schedules.complete'
    )
  ),
  'schedule permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_schedule_definition(uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[])',
    'execute'
  ),
  'authenticated can execute create_schedule_definition'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.derive_schedule_occurrence_status(text, date, text, timestamptz)',
    'execute'
  ),
  'authenticated can execute derive_schedule_occurrence_status'
);

select * from finish();
rollback;
