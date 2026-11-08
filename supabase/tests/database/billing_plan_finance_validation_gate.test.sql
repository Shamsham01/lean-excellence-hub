begin;

select plan(12);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2100000-0000-4000-8000-000000000001',
  'plan-fin-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b2100000-0000-4000-8000-000000000002',
  'plan-fin-finance@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table plan_fin_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on plan_fin_ids to authenticated;

insert into plan_fin_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2100000-0000-4000-8000-000000000001',
    'plan-fin-essentials-org',
    'Plan Finance Essentials Organisation'
  )
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from plan_fin_ids where key = 'organisation'),
    'fake',
    'cus_plan_fin_ess',
    'sub_plan_fin_ess',
    'essentials',
    'monthly',
    1,
    'price_fake_essentials_fin',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-11-08 12:00:00+00'
  ),
  'applied',
  'essentials subscription applies before finance validation'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b2110000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b2110000-0000-4000-8000-000000000002',
  'b2100000-0000-4000-8000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2110000-0000-4000-8000-000000000001","email":"plan-fin-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from plan_fin_ids where key = 'organisation')),
  'owner selects essentials organisation'
);

insert into plan_fin_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from plan_fin_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into plan_fin_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from plan_fin_ids where key = 'organisation')
  and membership_row.user_id = 'b2100000-0000-4000-8000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from plan_fin_ids where key = 'organisation'),
    'b2100000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into plan_fin_ids (key, id)
select 'finance_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b2100000-0000-4000-8000-000000000002';

insert into plan_fin_ids (key, id)
select 'finance_role_version', public.create_role_draft(
  (select id from plan_fin_ids where key = 'organisation'),
  'plan-fin-validator',
  'Plan Finance Validator',
  'Finance validation only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2110000-0000-4000-8000-000000000001","email":"plan-fin-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_role_permission(
    (select id from plan_fin_ids where key = 'organisation'),
    (select id from plan_fin_ids where key = 'finance_role_version'),
    'benefits.validate.finance'
  ),
  'finance validator role receives finance validation permission'
);

select ok(
  public.publish_role_version(
    (select id from plan_fin_ids where key = 'organisation'),
    (select id from plan_fin_ids where key = 'finance_role_version')
  ),
  'finance validator role publishes'
);

insert into plan_fin_ids (key, id)
select 'finance_grant', public.grant_role_version(
  (select id from plan_fin_ids where key = 'organisation'),
  (select id from plan_fin_ids where key = 'finance_membership'),
  (select id from plan_fin_ids where key = 'finance_role_version'),
  'organisation',
  null
);

insert into plan_fin_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Essentials validation savings',
  (select id from plan_fin_ids where key = 'unit_root'),
  'financial',
  'Reduce utility spend',
  'hard_saving',
  null,
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from plan_fin_ids where key = 'financial_benefit'),
    'Essentials validation savings',
    'Reduce utility spend',
    'financial',
    'hard_saving',
    null,
    null,
    null,
    null,
    'Annual utility baseline',
    null,
    null,
    null,
    null,
    25000,
    null,
    null,
    null
  ),
  'financial draft accepts baseline'
);

insert into plan_fin_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from plan_fin_ids where key = 'financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  40000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from plan_fin_ids where key = 'forecast_version'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-12-31',
        'forecast_amount', 40000,
        'display_order', 1
      )
    )
  ),
  'forecast periods align with total'
);

select ok(
  public.submit_benefit_forecast((select id from plan_fin_ids where key = 'forecast_version')),
  'forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from plan_fin_ids where key = 'financial_benefit'),
    (select id from plan_fin_ids where key = 'owner_membership'),
    (select id from plan_fin_ids where key = 'finance_membership')
  ) is not null,
  'financial benefit submits with distinct validators'
);

select ok(
  public.record_benefit_validation(
    (select id from plan_fin_ids where key = 'financial_benefit'),
    'ci',
    'approve',
    'CI validation complete on essentials'
  ) is not null,
  'CI validator can approve on essentials'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b2110000-0000-4000-8000-000000000002","email":"plan-fin-finance@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from plan_fin_ids where key = 'organisation')),
  'finance validator selects essentials organisation'
);

select throws_ok(
  format(
    'select public.record_benefit_validation(%L::uuid, %L, %L, %L)',
    (select id from plan_fin_ids where key = 'financial_benefit'),
    'finance',
    'approve',
    'Finance validation blocked'
  ),
  'finance benefit validation requires a Professional plan',
  '42501'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.record_benefit_validation(uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.record_benefit_validation directly'
);

select * from finish();

rollback;
