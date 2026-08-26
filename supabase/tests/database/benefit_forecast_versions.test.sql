begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b5000000-0000-0000-0000-000000000001',
  'benefit-forecast-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table forecast_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on forecast_ids to authenticated;

insert into forecast_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b5000000-0000-0000-0000-000000000001',
    'benefit-forecast-org',
    'Benefit Forecast Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b5100000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5100000-0000-0000-0000-000000000001","email":"benefit-forecast-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from forecast_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into forecast_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from forecast_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into forecast_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from forecast_ids where key = 'organisation')
  and membership_row.user_id = 'b5000000-0000-0000-0000-000000000001';

insert into forecast_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Forecast integrity benefit',
  (select id from forecast_ids where key = 'unit_root'),
  'financial',
  'Validate forecast period totals',
  'hard_saving',
  null,
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from forecast_ids where key = 'financial_benefit'),
    'Forecast integrity benefit',
    'Validate forecast period totals',
    'financial',
    'hard_saving',
    null,
    null,
    null,
    null,
    'Annual spend baseline',
    null,
    null,
    null,
    null,
    18000,
    null,
    null,
    null
  ),
  'financial draft accepts baseline'
);

insert into forecast_ids (key, id)
select 'financial_forecast', public.create_benefit_forecast_draft(
  (select id from forecast_ids where key = 'financial_benefit'),
  'recurring',
  '2026-01-01'::date,
  '2026-12-31'::date,
  12000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from forecast_ids where key = 'financial_forecast'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-06-30',
        'forecast_amount', 5000,
        'display_order', 1
      ),
      jsonb_build_object(
        'period_start', '2026-07-01',
        'period_end', '2026-12-31',
        'forecast_amount', 6000,
        'display_order', 2
      )
    )
  ),
  'misaligned forecast periods are saved'
);

select throws_ok(
  format(
    'select public.submit_benefit_forecast(%L::uuid)',
    (select id from forecast_ids where key = 'financial_forecast')
  ),
  'forecast period totals do not match forecast total',
  '22023'
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from forecast_ids where key = 'financial_forecast'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-06-30',
        'forecast_amount', 6000,
        'display_order', 1
      ),
      jsonb_build_object(
        'period_start', '2026-07-01',
        'period_end', '2026-12-31',
        'forecast_amount', 6000,
        'display_order', 2
      )
    )
  ),
  'forecast periods align with total'
);

select ok(
  public.submit_benefit_forecast((select id from forecast_ids where key = 'financial_forecast')),
  'aligned financial forecast submits'
);

insert into forecast_ids (key, id)
select 'successor_benefit', public.create_benefit_draft(
  'Successor history benefit',
  (select id from forecast_ids where key = 'unit_root'),
  'non_financial',
  'Forecast successor history',
  null,
  'quality',
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from forecast_ids where key = 'successor_benefit'),
    'Successor history benefit',
    'Forecast successor history',
    'non_financial',
    null,
    'quality',
    null,
    null,
    null,
    'Baseline defect rate',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  'successor benefit draft accepts baseline'
);

insert into forecast_ids (key, id)
select 'forecast_v1', public.create_benefit_forecast_draft(
  (select id from forecast_ids where key = 'successor_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  null,
  null,
  null,
  1,
  'defects',
  '2026-12-31'::date
);

select ok(
  public.submit_benefit_forecast((select id from forecast_ids where key = 'forecast_v1')),
  'successor benefit forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from forecast_ids where key = 'successor_benefit'),
    (select id from forecast_ids where key = 'owner_membership'),
    null
  ) is not null,
  'successor benefit submits'
);

select ok(
  public.record_benefit_validation(
    (select id from forecast_ids where key = 'successor_benefit'),
    'ci',
    'approve',
    'CI validation complete'
  ) is not null,
  'CI validation approves successor benefit forecast'
);

select is(
  (
    select lifecycle
    from public.benefit_forecast_versions
    where id = (select id from forecast_ids where key = 'forecast_v1')
  ),
  'approved',
  'submitted forecast becomes approved with benefit'
);

reset role;

update public.improvement_benefits benefit_table
set status = 'draft'
where benefit_table.id = (select id from forecast_ids where key = 'successor_benefit');

select set_config(
  'request.jwt.claims',
  '{"sub":"b5000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5100000-0000-0000-0000-000000000001","email":"benefit-forecast-owner@example.test"}',
  true
);
set local role authenticated;

insert into forecast_ids (key, id)
select 'forecast_v2', public.create_benefit_forecast_successor_version(
  (select id from forecast_ids where key = 'successor_benefit')
);

select ok(
  (
    select version_number
    from public.benefit_forecast_versions
    where id = (select id from forecast_ids where key = 'forecast_v2')
  ) = 2,
  'successor forecast increments version number'
);

select ok(
  exists (
    select 1
    from public.get_benefit_forecast_history((select id from forecast_ids where key = 'successor_benefit')) history
    cross join lateral jsonb_array_elements(history -> 'items') item
    where item ->> 'lifecycle' = 'approved'
      and (item ->> 'version_number')::integer = 1
  ),
  'forecast history retains approved predecessor version'
);

select * from finish();
rollback;
