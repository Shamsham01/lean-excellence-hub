begin;

select plan(4);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in ('job_functions.read', 'job_functions.manage')
  ),
  'job function permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_job_function(text, text, text)',
    'execute'
  ),
  'authenticated can execute create_job_function'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.assign_membership_job_function(uuid, uuid, boolean, uuid, timestamptz, timestamptz, text)',
    'execute'
  ),
  'authenticated can execute assign_membership_job_function'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class class_row on class_row.oid = constraint_row.conrelid
    where class_row.relname = 'membership_job_function_assignments'
      and constraint_row.conname = 'membership_job_function_primary_no_overlap'
  ),
  'primary assignment overlap exclusion constraint exists'
);

select * from finish();
rollback;
