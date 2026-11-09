begin;

select plan(7);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values (
  'b2920000-0000-4000-8000-000000000001',
  'credit-summary@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table credit_summary_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on credit_summary_ids to authenticated;

insert into credit_summary_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2920000-0000-4000-8000-000000000001',
    'credit-summary-org',
    'Credit Summary Volatile Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from credit_summary_ids where key = 'organisation'),
  'fake',
  'cus_credit_summary',
  'sub_credit_summary',
  'essentials',
  'monthly',
  1,
  'price_fake_credit_summary',
  'active',
  'active',
  statement_timestamp(),
  statement_timestamp() + interval '30 days',
  false,
  timestamptz '2026-11-09 12:00:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id,
  ai_enabled,
  credit_policy_enforced
)
values (
  (select id from credit_summary_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update
set credit_policy_enforced = true,
    ai_enabled = true;

select is(
  (
    select proc_row.provolatile
    from pg_proc proc_row
    join pg_namespace namespace_row on namespace_row.oid = proc_row.pronamespace
    where namespace_row.nspname = 'public'
      and proc_row.proname = 'get_organisation_ai_credit_period_summary'
      and proc_row.pronargs = 0
  ),
  'v',
  'get_organisation_ai_credit_period_summary is volatile (allocates current period)'
);

select ok(
  (
    select proc_row.prosecdef
    from pg_proc proc_row
    join pg_namespace namespace_row on namespace_row.oid = proc_row.pronamespace
    where namespace_row.nspname = 'public'
      and proc_row.proname = 'get_organisation_ai_credit_period_summary'
      and proc_row.pronargs = 0
  ),
  'get_organisation_ai_credit_period_summary remains security definer'
);

select is(
  (
    select proc_row.proconfig
    from pg_proc proc_row
    join pg_namespace namespace_row on namespace_row.oid = proc_row.pronamespace
    where namespace_row.nspname = 'public'
      and proc_row.proname = 'get_organisation_ai_credit_period_summary'
      and proc_row.pronargs = 0
  ),
  array['search_path=""']::text[],
  'get_organisation_ai_credit_period_summary keeps empty search_path'
);

select is(
  (
    select count(*)::bigint
    from public.organisation_ai_credit_periods period_row
    where period_row.organisation_id = (
      select id from credit_summary_ids where key = 'organisation'
    )
  ),
  0::bigint,
  'no AI credit period exists before summary RPC'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2921000-0000-4000-8000-000000000001',
  'b2920000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2920000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2921000-0000-4000-8000-000000000001","email":"credit-summary@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from credit_summary_ids where key = 'organisation')
  ),
  'member selects organisation for credit summary'
);

select is(
  (select count(*) from public.get_organisation_ai_credit_period_summary()),
  1::bigint,
  'summary returns exactly one row and allocates the missing period'
);

reset role;

select ok(
  exists (
    select 1
    from public.organisation_ai_credit_periods period_row
    where period_row.organisation_id = (
      select id from credit_summary_ids where key = 'organisation'
    )
  ),
  'organisation_ai_credit_periods row exists after volatile summary'
);

select * from finish();

rollback;
