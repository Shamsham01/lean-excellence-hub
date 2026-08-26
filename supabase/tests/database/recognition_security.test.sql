begin;

select plan(3);

select ok(
  exists (
    select 1 from public.permission_definitions
    where permission_key in ('recognition.read', 'recognition.award', 'recognition.manage')
  ),
  'recognition permissions are registered'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.award_recognition(uuid, text, text, uuid, text, uuid[], uuid, text[])',
    'execute'
  ),
  'authenticated can execute award_recognition'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename like '%engagement_score%'
  ),
  'no engagement score table exists'
);

select * from finish();
rollback;
