begin;
select plan(2);

select ok(
  (
    public.get_people_directory(null, 1, 5, false, null, null)
      ? 'total_count'
  ),
  'people directory exposes total_count'
);

select ok(
  (
    jsonb_typeof(
      public.get_people_directory(null, 1, 5, false, null, null) -> 'people'
    ) = 'array'
  ),
  'people directory still returns people array'
);

select * from finish();
rollback;
