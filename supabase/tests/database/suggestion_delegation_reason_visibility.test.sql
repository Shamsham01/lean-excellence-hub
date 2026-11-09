-- Delegation reason persistence + in-app notification body (requires routing fixture from sibling tests).

begin;

select plan(2);

select isnt_empty(
  $$
    select 1
    from pg_proc routine_row
    join pg_namespace namespace_row on namespace_row.oid = routine_row.pronamespace
    where namespace_row.nspname = 'private'
      and routine_row.proname = 'lookup_suggestion_delegation_reason_for_recipient'
  $$,
  'lookup_suggestion_delegation_reason_for_recipient exists'
);

select isnt_empty(
  $$
    select 1
    from pg_proc routine_row
    join pg_namespace namespace_row on namespace_row.oid = routine_row.pronamespace
    where namespace_row.nspname = 'private'
      and routine_row.proname = 'delegate_suggestion_approval'
  $$,
  'delegate_suggestion_approval remains available after reason visibility migration'
);

select * from finish();

rollback;
