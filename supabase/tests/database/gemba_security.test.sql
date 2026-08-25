begin;

select plan(2);

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
    'public.create_gemba_definition_draft(text, text, integer)',
    'execute'
  ),
  'authenticated can execute create_gemba_definition_draft'
);

select * from finish();
rollback;
