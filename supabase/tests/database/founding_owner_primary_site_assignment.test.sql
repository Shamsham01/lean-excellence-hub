begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'founder-primary-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'founder-primary-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

create temporary table founder_primary_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on founder_primary_ids to authenticated, anon;

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('founder-primary-a@example.test'),
    'f1000000-0000-4000-8000-000000000001'
  ),
  'founder A receives founding capability'
);

select ok(
  public.finalise_founding_signup(
    public.prepare_founding_signup_binding('founder-primary-b@example.test'),
    'f1000000-0000-4000-8000-000000000002'
  ),
  'founder B receives founding capability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000001","email":"founder-primary-a@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into founder_primary_ids (key, id) values (
    'organisation_a',
    public.create_founding_organisation(
      'Primary Site Org A', 'GB', 'en-GB', 'UTC', 'GBP', 'Org A First Site', 2, 'fake', 'no'
    )
  )$$,
  'founder A can provision organisation with primary site assignment'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.organisation_units unit_row
    where unit_row.organisation_id = (select id from founder_primary_ids where key = 'organisation_a')
      and unit_row.unit_type = 'site'
  ),
  1::bigint,
  'founding creates only the first site in the new organisation'
);

select is(
  (
    select count(*)::bigint
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (select id from founder_primary_ids where key = 'organisation_a')
      and assignment_row.is_primary
      and assignment_row.valid_to is null
      and assignment_row.organisational_unit_id = (
        select unit_row.id
        from public.organisation_units unit_row
        where unit_row.organisation_id = (select id from founder_primary_ids where key = 'organisation_a')
          and unit_row.unit_type = 'site'
        order by unit_row.created_at
        limit 1
      )
  ),
  1::bigint,
  'founder receives one active primary assignment on the first site'
);

select is(
  (
    select job_function_row.code
    from public.job_functions job_function_row
    where job_function_row.organisation_id = (select id from founder_primary_ids where key = 'organisation_a')
      and job_function_row.code = 'organisation-lead'
  ),
  'organisation-lead',
  'founding job function is scoped to the new organisation'
);


select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000002","email":"founder-primary-b@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into founder_primary_ids (key, id) values (
    'organisation_b',
    public.create_founding_organisation(
      'Primary Site Org B', 'GB', 'en-GB', 'UTC', 'GBP', 'Org B First Site', 1, 'fake', 'no'
    )
  )$$,
  'founder B can provision a separate organisation'
);

select is(
  (
    select count(*)::bigint
    from public.job_functions job_function_row
    where job_function_row.code = 'organisation-lead'
      and job_function_row.organisation_id = (
        select id from founder_primary_ids where key = 'organisation_a'
      )
  ),
  0::bigint,
  'founder B cannot see organisation A job functions through RLS'
);

select is(
  (
    select count(*)::bigint
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = (
        select id from founder_primary_ids where key = 'organisation_a'
      )
  ),
  0::bigint,
  'founder B cannot see organisation A membership job function assignments'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.create_founding_organisation(
    'Anon Org', 'GB', 'en-GB', 'UTC', 'GBP', 'Anon Site', 1, 'fake', 'no'
  )$$,
  '42501',
  null,
  'anon cannot execute create_founding_organisation'
);

reset role;

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_founding_organisation(text, text, text, text, text, text, integer, text, text)',
    'EXECUTE'
  ),
  'anon lacks execute privilege on create_founding_organisation'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.create_founding_organisation(text, text, text, text, text, text, integer, text, text)',
    'EXECUTE'
  ),
  'anon lacks execute privilege on private.create_founding_organisation'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_founding_organisation(text, text, text, text, text, text, integer, text, text)',
    'EXECUTE'
  ),
  'authenticated retains execute on create_founding_organisation'
);

select * from finish();
rollback;
