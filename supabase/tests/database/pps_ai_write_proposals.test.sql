begin;
select plan(4);

select ok(
  (
    select count(*) = 1
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
  (
    select pg_get_constraintdef(constraint_row.oid) ~ 'problem_statement'
      and pg_get_constraintdef(constraint_row.oid) ~ 'target_condition'
      and pg_get_constraintdef(constraint_row.oid) ~ 'five_why_chain'
      and pg_get_constraintdef(constraint_row.oid) ~ 'fishbone_cause'
    from pg_constraint constraint_row
    join pg_class class_row on class_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'public'
      and class_row.relname = 'ai_proposals'
      and constraint_row.conname = 'ai_proposals_type_check'
  ),
  'ai_proposals type check includes new write proposal types'
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

select ok(
  exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'update_problem_solving_target_condition'
  ),
  'update_problem_solving_target_condition rpc exists'
);

select * from finish();
rollback;
