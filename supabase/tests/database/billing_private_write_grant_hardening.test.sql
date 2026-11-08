begin;

select plan(4);

select ok(
  not has_function_privilege(
    'public',
    'private.complete_project(uuid, text, text, text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute private complete_project'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.record_ai_proposal_accepted(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private record_ai_proposal_accepted overload'
);

select ok(
  has_function_privilege(
    'lean_hub_private_owner',
    'private.record_ai_proposal_accepted(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid)',
    'EXECUTE'
  ),
  'lean_hub_private_owner retains proposal accept execute'
);

select ok(
  (
    select count(*)::int
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'private'
      and proc.proname in (
        'complete_project',
        'record_ai_proposal_accepted',
        'create_project',
        'start_ai_run'
      )
      and (
        has_function_privilege('public', proc.oid, 'EXECUTE')
        or has_function_privilege('authenticated', proc.oid, 'EXECUTE')
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
          and has_function_privilege('authenticated', pub.oid, 'EXECUTE')
      )
  ) = 0,
  'sample pro private writers lack PUBLIC/authenticated execute without invoker wrapper'
);

select * from finish();
rollback;
