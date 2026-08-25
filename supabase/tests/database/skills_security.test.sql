begin;

select plan(4);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in ('skills.read', 'skills.assess')
  ),
  'skills permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_skill_validation(uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text)',
    'execute'
  ),
  'authenticated can execute record_skill_validation'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = 'skill_proficiency_scale_versions'
  ),
  'proficiency scale versions table exists'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class class_row on class_row.oid = constraint_row.conrelid
    where class_row.relname = 'membership_skill_assessments'
      and constraint_row.conname = 'membership_skill_assessments_authoritative_check'
  ),
  'self assessed cannot be authoritative'
);

select * from finish();
rollback;
