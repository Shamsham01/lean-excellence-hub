begin;

select plan(16);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b3000000-0000-0000-0000-000000000001',
  'benefit-validation-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b3000000-0000-0000-0000-000000000002',
  'benefit-validation-finance@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table validation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on validation_ids to authenticated;

insert into validation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b3000000-0000-0000-0000-000000000001',
    'benefit-validation-org',
    'Benefit Validation Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b3100000-0000-0000-0000-000000000001',
  'b3000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b3100000-0000-0000-0000-000000000002',
  'b3000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b3100000-0000-0000-0000-000000000001","email":"benefit-validation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into validation_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from validation_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into validation_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from validation_ids where key = 'organisation')
  and membership_row.user_id = 'b3000000-0000-0000-0000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from validation_ids where key = 'organisation'),
    'b3000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into validation_ids (key, id)
select 'finance_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b3000000-0000-0000-0000-000000000002';

insert into validation_ids (key, id)
select 'finance_role_version', public.create_role_draft(
  (select id from validation_ids where key = 'organisation'),
  'benefit-finance-validator',
  'Benefit Finance Validator',
  'Finance validation only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b3100000-0000-0000-0000-000000000001","email":"benefit-validation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_role_permission(
    (select id from validation_ids where key = 'organisation'),
    (select id from validation_ids where key = 'finance_role_version'),
    'benefits.validate.finance'
  ),
  'finance validator role receives finance validation permission'
);

select ok(
  public.add_role_permission(
    (select id from validation_ids where key = 'organisation'),
    (select id from validation_ids where key = 'finance_role_version'),
    'benefits.validate.ci'
  ),
  'finance validator role receives CI validation permission for separation tests'
);

select ok(
  public.publish_role_version(
    (select id from validation_ids where key = 'organisation'),
    (select id from validation_ids where key = 'finance_role_version')
  ),
  'finance validator role publishes'
);

insert into validation_ids (key, id)
select 'finance_grant', public.grant_role_version(
  (select id from validation_ids where key = 'organisation'),
  (select id from validation_ids where key = 'finance_membership'),
  (select id from validation_ids where key = 'finance_role_version'),
  'organisation',
  null
);

insert into validation_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Validation savings',
  (select id from validation_ids where key = 'unit_root'),
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
    (select id from validation_ids where key = 'financial_benefit'),
    'Validation savings',
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

insert into validation_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from validation_ids where key = 'financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  40000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from validation_ids where key = 'forecast_version'),
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
  public.submit_benefit_forecast((select id from validation_ids where key = 'forecast_version')),
  'forecast submits'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validation_ids where key = 'financial_benefit'),
    (select id from validation_ids where key = 'finance_membership'),
    (select id from validation_ids where key = 'finance_membership')
  ),
  'CI and finance validators must be different memberships',
  '22023'
);

select ok(
  public.submit_benefit(
    (select id from validation_ids where key = 'financial_benefit'),
    (select id from validation_ids where key = 'owner_membership'),
    (select id from validation_ids where key = 'finance_membership')
  ) is not null,
  'financial benefit submits with distinct validators'
);

select ok(
  public.record_benefit_validation(
    (select id from validation_ids where key = 'financial_benefit'),
    'ci',
    'needs_more_information',
    'Please clarify calculation basis'
  ) is not null,
  'CI validator can request more information'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from validation_ids where key = 'financial_benefit')),
  'submitted',
  'needs_more_information keeps benefit submitted'
);

select ok(
  public.record_benefit_validation(
    (select id from validation_ids where key = 'financial_benefit'),
    'ci',
    'approve',
    'CI validation complete after clarification'
  ) is not null,
  'CI validator approves benefit'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from validation_ids where key = 'financial_benefit')),
  'submitted',
  'CI approval alone does not approve financial benefit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b3100000-0000-0000-0000-000000000002","email":"benefit-validation-finance@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from validation_ids where key = 'organisation')),
  'finance validator selects organisation'
);

select ok(
  public.record_benefit_validation(
    (select id from validation_ids where key = 'financial_benefit'),
    'finance',
    'approve',
    'Finance validation complete'
  ) is not null,
  'finance validator approves benefit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b3100000-0000-0000-0000-000000000001","email":"benefit-validation-owner@example.test"}',
  true
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from validation_ids where key = 'financial_benefit')),
  'approved',
  'financial benefit requires both CI and finance approvals'
);

select * from finish();
rollback;
