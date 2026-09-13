begin;

select plan(3);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in (
      'gemba.read',
      'gemba.definitions.manage',
      'gemba.walk.perform'
    )
  ),
  'gemba permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_gemba_definition_draft(text, text, integer, uuid[])',
    'execute'
  ),
  'authenticated can execute create_gemba_definition_draft'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.set_gemba_definition_applicable_units(uuid, uuid[])',
    'execute'
  ),
  'authenticated can execute set_gemba_definition_applicable_units'
);

select * from finish();
rollback;
