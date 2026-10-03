begin;

select plan(16);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c2170000-0000-4000-8000-000000000001',
    'leanai-web-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c2170000-0000-4000-8000-000000000002',
    'leanai-web-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c2170000-0000-4000-8000-000000000003',
    'leanai-web-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table leanai_web_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on leanai_web_ids to authenticated;

insert into leanai_web_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'c2170000-0000-4000-8000-000000000001',
      'leanai-web-a',
      'LeanAI Web Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'c2170000-0000-4000-8000-000000000003',
      'leanai-web-b',
      'LeanAI Web Org B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c2171000-0000-4000-8000-000000000001',
    'c2170000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2171000-0000-4000-8000-000000000002',
    'c2170000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2171000-0000-4000-8000-000000000003',
    'c2170000-0000-4000-8000-000000000003',
    statement_timestamp(), statement_timestamp()
  );

select is(
  (
    select count(*)
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'update_organisation_ai_settings'
  ),
  1::bigint,
  'exactly one public update_organisation_ai_settings signature exists'
);

select is(
  (
    select pg_get_function_identity_arguments(procedure_row.oid)
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'update_organisation_ai_settings'
  ),
  'target_ai_enabled boolean, target_monthly_token_ceiling integer, target_web_search_enabled boolean',
  'canonical public settings RPC is the 3-argument signature'
);

select is(
  (
    select count(*)
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'private'
      and procedure_row.proname = 'update_organisation_ai_settings'
  ),
  1::bigint,
  'legacy private 2-argument update_organisation_ai_settings overload is removed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c2170000-0000-4000-8000-000000000001","role":"authenticated","session_id":"c2171000-0000-4000-8000-000000000001","email":"leanai-web-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_web_ids where key = 'org_a')),
  'owner selects organisation A'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'existing two-argument AI enabled/token ceiling updates still work'
);

select is(
  (
    select settings_row.web_search_enabled
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id = (select id from leanai_web_ids where key = 'org_a')
  ),
  false,
  'web_search_enabled defaults false and is preserved when omitted from the RPC'
);

select is(
  public.get_leanai_contextual_snapshot() ->> 'web_search_enabled',
  'false',
  'snapshot exposes web search as disabled by default'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000, true)$$,
  'organisation admin with ai.manage_settings can enable web search'
);

select is(
  (
    select settings_row.web_search_enabled
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id = (select id from leanai_web_ids where key = 'org_a')
  ),
  true,
  'web_search_enabled is stored true after authorised update'
);

select is(
  public.get_leanai_contextual_snapshot() ->> 'web_search_enabled',
  'true',
  'snapshot reflects the current organisation web-search setting'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 250000)$$,
  'omitting web search on a later update does not reset the stored preference'
);

select is(
  (
    select settings_row.monthly_token_ceiling
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id = (select id from leanai_web_ids where key = 'org_a')
  ),
  250000,
  'monthly token ceiling updates still persist'
);

select is(
  (
    select settings_row.web_search_enabled
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id = (select id from leanai_web_ids where key = 'org_a')
  ),
  true,
  'web search preference survives a two-argument settings update'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from leanai_web_ids where key = 'org_a'),
    'c2170000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into leanai_web_ids (key, id)
select 'member_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c2170000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"c2170000-0000-4000-8000-000000000002","role":"authenticated","session_id":"c2171000-0000-4000-8000-000000000002","email":"leanai-web-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_web_ids where key = 'org_a')),
  'unprivileged member selects organisation A'
);

select throws_ok(
  $$select public.update_organisation_ai_settings(true, 100000, false)$$,
  '42501',
  'ai settings update is not authorised',
  'member without ai.manage_settings cannot change web search'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"c2170000-0000-4000-8000-000000000003","role":"authenticated","session_id":"c2171000-0000-4000-8000-000000000003","email":"leanai-web-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from leanai_web_ids where key = 'org_b')),
  'outsider selects organisation B'
);

select is(
  public.get_leanai_contextual_snapshot() ->> 'web_search_enabled',
  'false',
  'another organisation does not reuse organisation A web-search preference'
);

select ok(
  not exists (
    select 1
    from public.organisation_ai_settings settings_row
    where settings_row.organisation_id = (select id from leanai_web_ids where key = 'org_a')
  ),
  'cross-tenant actor cannot read organisation A AI settings'
);

reset role;

select * from finish();
rollback;
