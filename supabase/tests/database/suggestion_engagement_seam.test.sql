begin;

select plan(2);

select ok(
  exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = 'improvement_suggestions'
  ),
  'improvement suggestions attribution source exists'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename like '%engagement%score%'
  ),
  'engagement score storage is not introduced'
);

select * from finish();
rollback;
