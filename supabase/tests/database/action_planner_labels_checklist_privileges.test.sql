begin;

select plan(8);

select ok(
  (
    select pg_catalog.pg_get_userbyid(p.proowner) = 'lean_hub_private_owner'
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'has_permission_any_unit_scope'
  ),
  'has_permission_any_unit_scope is owned by lean_hub_private_owner'
);

select ok(
  (
    select pg_catalog.pg_get_userbyid(p.proowner) = 'lean_hub_private_owner'
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'validate_action_card_cover_attachment'
  ),
  'validate_action_card_cover_attachment is owned by lean_hub_private_owner'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.has_permission_any_unit_scope(uuid, text)',
    'execute'
  ),
  'authenticated may execute has_permission_any_unit_scope'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.has_permission_any_unit_scope(uuid, text)',
    'execute'
  ),
  'anon cannot execute has_permission_any_unit_scope'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'private.has_permission_any_unit_scope(uuid, text)',
    'execute'
  ),
  'public cannot execute has_permission_any_unit_scope'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.validate_action_card_cover_attachment()',
    'execute'
  ),
  'anon cannot execute validate_action_card_cover_attachment'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'private.validate_action_card_cover_attachment()',
    'execute'
  ),
  'public cannot execute validate_action_card_cover_attachment'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.validate_action_card_cover_attachment()',
    'execute'
  ),
  'authenticated cannot execute validate_action_card_cover_attachment trigger helper'
);

select finish();

rollback;
