-- Signature-aware grant audit for inventoried private write RPCs (inventory in
-- docs/operations/rpc-entitlement-inventory.md; generator: audit-private-write-grants.py).

begin;

select plan(3);

select is(
  (
    select count(*)::int
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'private'
      and proc.proname in (
        'complete_project',
        'record_ai_proposal_accepted',
        'create_project',
        'start_ai_run',
        'link_problem_solving_evidence'
      )
      and (
        pg_catalog.has_function_privilege('public', proc.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
      )
      and not exists (
        select 1
        from pg_catalog.pg_proc pub
        join pg_catalog.pg_namespace pub_ns on pub_ns.oid = pub.pronamespace
        where pub_ns.nspname = 'public'
          and pub.proname = proc.proname
          and pub.prosecdef = false
          and pg_catalog.pg_get_function_identity_arguments(pub.oid)
            = pg_catalog.pg_get_function_identity_arguments(proc.oid)
          and pg_catalog.has_function_privilege('authenticated', pub.oid, 'EXECUTE')
      )
  ),
  0,
  'inventoried private writer overloads lack EXECUTE without matching public invoker wrapper'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'private.complete_project(uuid, text, text, text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute private.complete_project (full signature)'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.record_ai_proposal_accepted(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private record_ai_proposal_accepted overload (full signature)'
);

select * from finish();
rollback;
