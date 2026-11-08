begin;

select plan(3);

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

select * from finish();
rollback;
