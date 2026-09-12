begin;

select plan(3);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in (
      'five_s.read',
      'five_s.standards.manage',
      'five_s.audit.perform'
    )
  ),
  'five_s permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_five_s_standard_draft(text, text, numeric)',
    'execute'
  ),
  'authenticated can execute create_five_s_standard_draft'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.set_five_s_standard_applicable_units(uuid, uuid[])',
    'execute'
  ),
  'authenticated can execute set_five_s_standard_applicable_units'
);

select * from finish();
rollback;
