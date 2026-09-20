begin;

select plan(3);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_suggestion_detail(uuid)',
    'execute'
  ),
  'authenticated can execute get_suggestion_detail'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.get_suggestion_detail(uuid)',
    'execute'
  ),
  'anon cannot execute get_suggestion_detail'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.get_suggestion_detail(uuid)',
    'execute'
  ),
  'public role cannot execute get_suggestion_detail'
);

select * from finish();
rollback;
