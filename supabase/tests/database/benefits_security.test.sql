begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b1000000-0000-0000-0000-000000000001',
  'benefits-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b1000000-0000-0000-0000-000000000003',
  'benefits-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table benefit_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on benefit_ids to authenticated;

insert into benefit_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000001',
    'benefits-org',
    'Benefits Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b1100000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b1100000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b1100000-0000-0000-0000-000000000001","email":"benefits-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from benefit_ids where key = 'organisation')),
  'owner selects organisation'
);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in (
      'benefits.read',
      'benefits.create',
      'benefits.manage',
      'benefits.validate.ci',
      'benefits.validate.finance'
    )
  ),
  'benefit permissions are registered'
);

insert into benefit_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from benefit_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into benefit_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from benefit_ids where key = 'organisation')
  and membership_row.user_id = 'b1000000-0000-0000-0000-000000000001';

insert into benefit_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Energy savings',
  (select id from benefit_ids where key = 'unit_root'),
  'financial',
  'Reduce compressed air leakage',
  'hard_saving',
  null,
  null,
  null,
  true
);

select ok(
  (select id from benefit_ids where key = 'financial_benefit') is not null,
  'financial benefit draft is created'
);

select throws_ok(
  format(
    'select public.create_benefit_draft(%L, %L::uuid, %L, %L, %L, %L, null, null, true)',
    'Invalid financial benefit',
    (select id from benefit_ids where key = 'unit_root'),
    'financial',
    'Missing financial type',
    null,
    null
  ),
  'financial benefit requires a financial type',
  '22023'
);

insert into benefit_ids (key, id)
select 'non_financial_benefit', public.create_benefit_draft(
  'Safety improvement',
  (select id from benefit_ids where key = 'unit_root'),
  'non_financial',
  'Reduce near-miss incidents',
  null,
  'safety',
  null,
  null,
  true
);

select ok(
  (select id from benefit_ids where key = 'non_financial_benefit') is not null,
  'non-financial benefit draft is created'
);

select throws_ok(
  format(
    'select public.update_benefit_draft(%L::uuid, %L, %L, %L, %L, %L)',
    (select id from benefit_ids where key = 'non_financial_benefit'),
    'Safety improvement',
    'Reduce near-miss incidents',
    'financial',
    null,
    null
  ),
  'financial benefit requires a financial type',
  '22023'
);

select ok(
  public.update_benefit_draft(
    (select id from benefit_ids where key = 'non_financial_benefit'),
    'Safety improvement',
    'Reduce near-miss incidents',
    'non_financial',
    null,
    'safety',
    null,
    null,
    null,
    'Baseline near-miss count',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  'non-financial draft accepts baseline description'
);

insert into benefit_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from benefit_ids where key = 'non_financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  null,
  null,
  null,
  10,
  'incidents',
  '2026-12-31'::date
);

select ok(
  public.submit_benefit_forecast((select id from benefit_ids where key = 'forecast_version')),
  'forecast submits before benefit'
);

select ok(
  public.submit_benefit(
    (select id from benefit_ids where key = 'non_financial_benefit'),
    (select id from benefit_ids where key = 'owner_membership'),
    null
  ) is not null,
  'non-financial benefit submits'
);

select ok(
  (select benefit_number from public.improvement_benefits
   where id = (select id from benefit_ids where key = 'non_financial_benefit')) like 'BEN-%',
  'submitted benefit receives display number'
);

select throws_ok(
  format(
    'select public.update_benefit_draft(%L::uuid, %L)',
    (select id from benefit_ids where key = 'non_financial_benefit'),
    'Renamed benefit'
  ),
  'benefit is not editable',
  '55000'
);

reset role;

insert into benefit_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000003',
    'benefits-org-b',
    'Benefits Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"b1100000-0000-0000-0000-000000000003","email":"benefits-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from benefit_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.get_benefit_detail(%L::uuid)',
    (select id from benefit_ids where key = 'non_financial_benefit')
  ),
  'benefit detail is not authorised',
  '42501'
);

select * from finish();
rollback;
