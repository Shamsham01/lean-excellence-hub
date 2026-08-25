begin;

select plan(3);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in ('training.read', 'training.completions.manage')
  ),
  'training permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_training_completion(uuid, uuid, timestamptz, uuid, text, text, uuid, integer, text, text)',
    'execute'
  ),
  'authenticated can execute record_training_completion'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class class_row on class_row.oid = constraint_row.conrelid
    where class_row.relname = 'training_completions'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%expired%'
      and constraint_row.contype = 'c'
  ),
  'training completion status check does not include expired lifecycle'
);

select * from finish();
rollback;
