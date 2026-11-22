begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2200000-0000-4000-8000-000000000001',
  'mod-wrap@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table mod_wrap_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on mod_wrap_ids to authenticated;

insert into mod_wrap_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2200000-0000-4000-8000-000000000001',
    'mod-wrap-org',
    'Module Wrapper Org'
  )
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from mod_wrap_ids where key = 'organisation'),
    'fake',
    'cus_mod_wrap',
    'sub_mod_wrap',
    'essentials',
    'monthly',
    1,
    'price_fake_mod_wrap',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-11-08 13:00:00+00'
  ),
  'applied',
  'essentials subscription for module wrapper test'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_organisation_plan_module_entitled(text)',
    'EXECUTE'
  ),
  'authenticated may execute public.current_organisation_plan_module_entitled'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.current_organisation_plan_capability(text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.current_organisation_plan_capability'
);

select ok(
  (
    select proc.prosecdef
    from pg_proc proc
    join pg_namespace namespace_table on namespace_table.oid = proc.pronamespace
    where namespace_table.nspname = 'public'
      and proc.proname = 'current_organisation_plan_module_entitled'
  ),
  'public.current_organisation_plan_module_entitled is security definer'
);

insert into auth.sessions (
  id, user_id, created_at, updated_at
)
values (
  'b2220000-0000-4000-8000-000000000001',
  'b2200000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2200000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2220000-0000-4000-8000-000000000001","email":"mod-wrap@example.test"}',
  true
);

set local role authenticated;

select public.switch_organisation(
  (select id from mod_wrap_ids where key = 'organisation')
);

select is(
  public.current_organisation_plan_module_entitled('maturity'),
  true,
  'authenticated essentials sees maturity entitled'
);

select is(
  public.current_organisation_plan_module_entitled('projects'),
  false,
  'authenticated essentials denied projects via public wrapper'
);

select * from finish();

rollback;
