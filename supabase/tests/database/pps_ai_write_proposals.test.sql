begin;
select plan(2);

select ok(
  (
    select count(*) = 14
    from pg_constraint constraint_row
    join pg_class class_row on class_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'public'
      and class_row.relname = 'ai_proposals'
      and constraint_row.conname = 'ai_proposals_type_check'
  ),
  'ai_proposals type check exists'
);

select ok(
  exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'update_problem_solving_problem_statement'
  ),
  'update_problem_solving_problem_statement rpc exists'
);

select * from finish();
rollback;
