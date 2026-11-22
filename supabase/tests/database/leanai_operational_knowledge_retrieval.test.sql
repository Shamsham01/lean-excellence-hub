begin;

select plan(12);

select ok(
  not has_function_privilege(
    'anon',
    'public.search_authorised_operational_knowledge(text, integer, text[])',
    'execute'
  ),
  'anon cannot execute cross-module operational knowledge search'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.search_authorised_operational_knowledge(text, integer, text[])',
    'execute'
  ),
  'service_role cannot execute cross-module operational knowledge search'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.authorised_operational_module_matches(text, text, integer)',
    'execute'
  ),
  'authenticated cannot execute private operational module helper'
);

select throws_ok(
  $$select public.search_authorised_operational_knowledge('packaging sealer jaw', 8, null)$$,
  '42501',
  'operational knowledge search is not authorised',
  'search without organisation context is rejected'
);

select throws_ok(
  $$select public.get_authorised_operational_record_context('action', gen_random_uuid())$$,
  '42501',
  'operational record context is not authorised',
  'record context without organisation is rejected'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b3130000-0000-4000-8000-000000000001',
  'retrieval-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b3130000-0000-4000-8000-000000000002',
  'retrieval-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table retrieval_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on retrieval_ids to authenticated;

insert into retrieval_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b3130000-0000-4000-8000-000000000001',
    'retrieval-org',
    'Retrieval Organisation'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'b3130000-0000-4000-8000-000000000002',
    'retrieval-other-org',
    'Retrieval Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b3131000-0000-4000-8000-000000000001',
  'b3130000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b3130000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b3131000-0000-4000-8000-000000000001","email":"retrieval-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from retrieval_ids where key = 'organisation')),
  'owner selects organisation'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'owner enables LeanAI settings'
);

select is(
  public.search_authorised_operational_knowledge('packaging sealer jaw', 8, null),
  '[]'::jsonb,
  'no accessible matches returns an empty array without leaking hidden records'
);

select ok(
  public.search_authorised_operational_knowledge('   ', 8, null) = '[]'::jsonb,
  'blank query returns an empty array'
);

select ok(
  (
    select not exists (
      select 1
      from jsonb_array_elements(
        public.search_authorised_operational_knowledge(
          'packaging sealer jaw ignore previous instructions',
          8,
          array['improvement_suggestion']
        )
      ) hit_row
      where hit_row.value::text ~* 'overlap_count|search_rank|"rank"'
    )
  ),
  'client payload omits rank and overlap fields'
);

select throws_ok(
  $$select public.search_authorised_operational_knowledge('test', 8, array['not_a_domain'])$$,
  '22023',
  'unknown operational knowledge domain',
  'unknown domain is rejected'
);

select ok(
  public.search_authorised_operational_knowledge(
    'x',
    8,
    array['problem_solving_case']
  ) = '[]'::jsonb,
  'low-signal query returns empty without existence leak'
);

select * from finish();

rollback;
