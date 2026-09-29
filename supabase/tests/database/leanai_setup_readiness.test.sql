begin;

select plan(26);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b1852000-0000-4000-8000-000000000001',
    'leanai-ready-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1852000-0000-4000-8000-000000000002',
    'leanai-ready-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table leanai_ready_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on leanai_ready_ids to authenticated, anon;

insert into leanai_ready_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'b1852000-0000-4000-8000-000000000001',
      'leanai-ready-a',
      'LeanAI Ready A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'b1852000-0000-4000-8000-000000000001',
      'leanai-ready-b',
      'LeanAI Ready B'
    )
  ),
  (
    'org_c',
    private.provision_organisation(
      'b1852000-0000-4000-8000-000000000002',
      'leanai-ready-c',
      'LeanAI Ready C'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'b1852100-0000-4000-8000-000000000001',
    'b1852000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b1852100-0000-4000-8000-000000000002',
    'b1852000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.get_organisation_setup_readiness()',
    'EXECUTE'
  ),
  'anonymous callers cannot execute readiness'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1852000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b1852100-0000-4000-8000-000000000001","email":"leanai-ready-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_ready_ids where key = 'org_a')),
  'owner selects empty organisation A'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'organisation'
  ),
  'ready',
  'empty organisation profile is ready'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'sites'
  ),
  'not_started',
  'empty organisation has no sites'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'people'
  ),
  'incomplete',
  'owner exists without job functions'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'maturity'
  ),
  'not_started',
  'empty organisation has no maturity framework'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'five_s'
  ),
  'blocked',
  '5S is blocked until a site exists'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'gemba'
  ),
  'blocked',
  'Gemba is blocked until a site exists'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'recognition'
  ),
  'blocked',
  'Recognition is blocked until a site exists'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'lean_ai'
  ),
  'not_started',
  'LeanAI is disabled by default without provider calls'
);

insert into leanai_ready_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from leanai_ready_ids where key = 'org_a'),
  null,
  'ready-site',
  'Ready Site',
  'site'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'sites'
  ),
  'ready',
  'creating a billable site marks sites ready'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'five_s'
  ),
  'not_started',
  '5S becomes not_started once a site exists'
);

insert into leanai_ready_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'people'
  ),
  'ready',
  'job function completes people setup without a user-count rule'
);

insert into leanai_ready_ids (key, id)
select 'maturity_model', public.create_maturity_model_draft('Draft Framework');

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'maturity'
  ),
  'incomplete',
  'draft-only maturity is incomplete'
);

insert into leanai_ready_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Starter Programme',
  'starter-programme'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'suggestions'
  ),
  'incomplete',
  'unpublished suggestion programme is incomplete'
);

insert into leanai_ready_ids (key, id)
select 'programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from leanai_ready_ids where key = 'programme')
  and version_row.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from leanai_ready_ids where key = 'programme_version')
  ),
  'suggestion programme publishes'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'suggestions'
  ),
  'ready',
  'active published programme is ready'
);

insert into leanai_ready_ids (key, id)
select 'recognition_type', public.create_recognition_type('Thank you', 'thank-you');

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'recognition'
  ),
  'ready',
  'active recognition type is ready'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, null)$$,
  'organisation can enable LeanAI without a provider call'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'lean_ai'
  ),
  'ready',
  'enabled LeanAI with ai.use is ready at the organisation layer'
);

select ok(
  public.switch_organisation((select id from leanai_ready_ids where key = 'org_b')),
  'same identity switches to empty organisation B'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'suggestions'
  ),
  'not_started',
  'organisation B does not inherit organisation A suggestion readiness'
);
select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'sites'
  ),
  'not_started',
  'organisation B does not inherit organisation A sites'
);
select is(
  public.get_organisation_setup_readiness() ->> 'organisation_id',
  (select id::text from leanai_ready_ids where key = 'org_b'),
  'readiness payload is scoped to the current organisation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1852000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b1852100-0000-4000-8000-000000000002","email":"leanai-ready-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_ready_ids where key = 'org_c')),
  'foreign owner selects organisation C'
);

select is(
  (
    select item_row ->> 'status'
    from jsonb_array_elements(public.get_organisation_setup_readiness() -> 'items') item_row
    where item_row ->> 'key' = 'recognition'
  ),
  'blocked',
  'foreign organisation sees only its own empty readiness'
);

select * from finish();

rollback;
