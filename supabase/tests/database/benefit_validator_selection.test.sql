begin;

select plan(42);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b4000000-0000-0000-0000-000000000001',
  'benefit-validator-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b4000000-0000-0000-0000-000000000002',
  'benefit-validator-finance1@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b4000000-0000-0000-0000-000000000003',
  'benefit-validator-finance2@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b4000000-0000-0000-0000-000000000004',
  'benefit-validator-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table validator_selection_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on validator_selection_ids to authenticated;

insert into validator_selection_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b4000000-0000-0000-0000-000000000001',
    'benefit-validator-org',
    'Benefit Validator Selection Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b4100000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b4100000-0000-0000-0000-000000000002',
  'b4000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into validator_selection_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from validator_selection_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into validator_selection_ids (key, id)
select 'unit_child', public.create_organisation_unit(
  (select id from validator_selection_ids where key = 'organisation'),
  (select id from validator_selection_ids where key = 'unit_root'),
  'child-line',
  'Child Line',
  'line'
);

insert into validator_selection_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from validator_selection_ids where key = 'organisation')
  and membership_row.user_id = 'b4000000-0000-0000-0000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at,
    display_name
  )
  values (
    (select id from validator_selection_ids where key = 'organisation'),
    'b4000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'Finance Validator One'
  )
  returning id
)
insert into validator_selection_ids (key, id)
select 'finance1_membership', id from inserted_membership;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at,
    display_name
  )
  values (
    (select id from validator_selection_ids where key = 'organisation'),
    'b4000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp(),
    'Finance Validator Two'
  )
  returning id
)
insert into validator_selection_ids (key, id)
select 'finance2_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'b4000000-0000-0000-0000-000000000002',
  'b4000000-0000-0000-0000-000000000003'
);

insert into validator_selection_ids (key, id)
select 'finance_role_version', public.create_role_draft(
  (select id from validator_selection_ids where key = 'organisation'),
  'benefit-finance-validator',
  'Benefit Finance Validator',
  'Finance validation only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_role_permission(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'finance_role_version'),
    'benefits.validate.finance'
  ),
  'finance validator role receives finance validation permission'
);

select ok(
  public.add_role_permission(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'finance_role_version'),
    'benefits.validate.ci'
  ),
  'finance validator role receives CI validation permission for explicit selection tests'
);

select ok(
  public.add_role_permission(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'finance_role_version'),
    'benefits.create'
  ),
  'finance validator role receives benefit creation permission for creator coverage tests'
);

select ok(
  public.add_role_permission(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'finance_role_version'),
    'benefits.manage'
  ),
  'finance validator role receives benefit manage permission for creator coverage tests'
);

select ok(
  public.publish_role_version(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'finance_role_version')
  ),
  'finance validator role publishes'
);

insert into validator_selection_ids (key, id)
select 'finance1_grant', public.grant_role_version(
  (select id from validator_selection_ids where key = 'organisation'),
  (select id from validator_selection_ids where key = 'finance1_membership'),
  (select id from validator_selection_ids where key = 'finance_role_version'),
  'organisation',
  null
);

insert into validator_selection_ids (key, id)
select 'scoped_finance_role_version', public.create_role_draft(
  (select id from validator_selection_ids where key = 'organisation'),
  'scoped-finance-validator',
  'Scoped Finance Validator',
  'Finance validation scoped to root only'
);

select ok(
  public.add_role_permission(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'scoped_finance_role_version'),
    'benefits.validate.finance'
  ),
  'scoped finance role receives finance validation permission'
);

select ok(
  public.publish_role_version(
    (select id from validator_selection_ids where key = 'organisation'),
    (select id from validator_selection_ids where key = 'scoped_finance_role_version')
  ),
  'scoped finance role publishes'
);

insert into validator_selection_ids (key, id)
select 'scoped_finance_grant', public.grant_role_version(
  (select id from validator_selection_ids where key = 'organisation'),
  (select id from validator_selection_ids where key = 'finance2_membership'),
  (select id from validator_selection_ids where key = 'scoped_finance_role_version'),
  'unit_subtree',
  (select id from validator_selection_ids where key = 'unit_child')
);

insert into validator_selection_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Validator selection savings',
  (select id from validator_selection_ids where key = 'unit_child'),
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
    (select id from validator_selection_ids where key = 'financial_benefit'),
    'Validator selection savings',
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

insert into validator_selection_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from validator_selection_ids where key = 'financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  40000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from validator_selection_ids where key = 'forecast_version'),
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
  public.submit_benefit_forecast((select id from validator_selection_ids where key = 'forecast_version')),
  'forecast submits'
);

select is(
  (public.resolve_benefit_submit_validators(
    (select id from validator_selection_ids where key = 'financial_benefit')
  )->>'finance_validator_membership_id'),
  null,
  'multiple finance validators do not auto-resolve finance selection'
);

select is(
  (public.resolve_benefit_submit_validators(
    (select id from validator_selection_ids where key = 'financial_benefit')
  )->>'requires_explicit_finance_selection')::boolean,
  true,
  'multiple finance validators require explicit finance selection'
);

select ok(
  public.submit_benefit(
    (select id from validator_selection_ids where key = 'financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ) is not null,
  'explicit finance validator is honoured on submit'
);

select is(
  (
    select assignment_row.validator_membership_id::text
    from public.benefit_validation_assignments assignment_row
    where assignment_row.benefit_id = (select id from validator_selection_ids where key = 'financial_benefit')
      and assignment_row.validation_role = 'finance'
      and assignment_row.status = 'active'
  ),
  (select id::text from validator_selection_ids where key = 'finance1_membership'),
  'finance assignment uses explicitly selected membership'
);

reset role;

insert into validator_selection_ids (key, id)
values (
  'outsider_organisation',
  private.provision_organisation(
    'b4000000-0000-0000-0000-000000000004',
    'benefit-validator-outsider-org',
    'Benefit Validator Outsider Organisation'
  )
);

insert into validator_selection_ids (key, id)
select 'outsider_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from validator_selection_ids where key = 'outsider_organisation')
  and membership_row.user_id = 'b4000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'owner re-selects organisation for rejection tests'
);

insert into validator_selection_ids (key, id)
select 'non_financial_benefit', public.create_benefit_draft(
  'Quality uplift',
  (select id from validator_selection_ids where key = 'unit_root'),
  'non_financial',
  'Improve quality',
  null,
  'quality',
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from validator_selection_ids where key = 'non_financial_benefit'),
    'Quality uplift',
    'Improve quality',
    'non_financial',
    null,
    'quality',
    null,
    null,
    null,
    'Baseline defect rate',
    null,
    null,
    120,
    'defects',
    null,
    null,
    null,
    null
  ),
  'non-financial draft accepts baseline measure'
);

insert into validator_selection_ids (key, id)
select 'non_financial_forecast', public.create_benefit_forecast_draft(
  (select id from validator_selection_ids where key = 'non_financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  null,
  null,
  null,
  95,
  'percent',
  '2026-12-31'::date
);

select ok(
  public.submit_benefit_forecast((select id from validator_selection_ids where key = 'non_financial_forecast')),
  'non-financial forecast submits'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'non_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ),
  'non-financial benefits do not require finance validation',
  '22023'
);

select ok(
  public.submit_benefit(
    (select id from validator_selection_ids where key = 'non_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    null
  ) is not null,
  'non-financial benefit requires CI validator only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000002","email":"benefit-validator-finance1@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'finance validator selects organisation to create benefit'
);

insert into validator_selection_ids (key, id)
select 'second_financial_benefit', public.create_benefit_draft(
  'Owner finance savings',
  (select id from validator_selection_ids where key = 'unit_root'),
  'financial',
  'Owner may validate when not creator',
  'hard_saving',
  null,
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from validator_selection_ids where key = 'second_financial_benefit'),
    'Owner finance savings',
    'Owner may validate when not creator',
    'financial',
    'hard_saving',
    null,
    null,
    null,
    null,
    'Annual baseline',
    null,
    null,
    null,
    null,
    10000,
    null,
    null,
    null
  ),
  'second financial draft accepts baseline'
);

insert into validator_selection_ids (key, id)
select 'second_forecast', public.create_benefit_forecast_draft(
  (select id from validator_selection_ids where key = 'second_financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  12000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from validator_selection_ids where key = 'second_forecast'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-12-31',
        'forecast_amount', 12000,
        'display_order', 1
      )
    )
  ),
  'second forecast periods align with total'
);

select ok(
  public.submit_benefit_forecast((select id from validator_selection_ids where key = 'second_forecast')),
  'second forecast submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'owner re-selects organisation to submit second benefit'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'second_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

select ok(
  public.submit_benefit(
    (select id from validator_selection_ids where key = 'second_financial_benefit'),
    (select id from validator_selection_ids where key = 'finance1_membership'),
    (select id from validator_selection_ids where key = 'owner_membership')
  ) is not null,
  'organisation owner may be explicit finance validator when not creator'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'second_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ),
  'benefit is not submittable',
  '55000'
);

insert into validator_selection_ids (key, id)
select 'third_financial_benefit', public.create_benefit_draft(
  'Rejection coverage savings',
  (select id from validator_selection_ids where key = 'unit_root'),
  'financial',
  'Rejection coverage',
  'hard_saving',
  null,
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    'Rejection coverage savings',
    'Rejection coverage',
    'financial',
    'hard_saving',
    null,
    null,
    null,
    null,
    'Annual baseline',
    null,
    null,
    null,
    null,
    8000,
    null,
    null,
    null
  ),
  'third financial draft accepts baseline'
);

insert into validator_selection_ids (key, id)
select 'third_forecast', public.create_benefit_forecast_draft(
  (select id from validator_selection_ids where key = 'third_financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  9000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from validator_selection_ids where key = 'third_forecast'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-12-31',
        'forecast_amount', 9000,
        'display_order', 1
      )
    )
  ),
  'third forecast periods align with total'
);

select ok(
  public.submit_benefit_forecast((select id from validator_selection_ids where key = 'third_forecast')),
  'third forecast submits'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'owner_membership')
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'finance1_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ),
  'CI and finance validators must be different memberships',
  '22023'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'outsider_membership')
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

reset role;

update public.organisation_memberships membership_row
set status = 'inactive',
    inactivated_at = statement_timestamp(),
    status_reason = 'inactive for validator eligibility test'
where membership_row.id = (select id from validator_selection_ids where key = 'finance1_membership');

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'owner re-selects organisation after inactivating finance validator'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

reset role;

update public.organisation_memberships membership_row
set status = 'active',
    activated_at = statement_timestamp(),
    inactivated_at = null,
    status_reason = null
where membership_row.id = (select id from validator_selection_ids where key = 'finance1_membership');

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-validator-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from validator_selection_ids where key = 'organisation')),
  'owner re-selects organisation after reactivating finance validator'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance2_membership')
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

select throws_ok(
  format(
    'select public.submit_benefit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    'b4000000-0000-0000-0000-000000009999'::uuid
  ),
  'finance validator is not eligible for this benefit',
  '42501'
);

select ok(
  not private.membership_has_scoped_permission(
    (select id from validator_selection_ids where key = 'finance2_membership'),
    (select id from validator_selection_ids where key = 'organisation'),
    'benefits.manage',
    null,
    (select id from validator_selection_ids where key = 'unit_root')
  ),
  'validator assignment does not grant RBAC manage permission'
);

select ok(
  public.submit_benefit(
    (select id from validator_selection_ids where key = 'third_financial_benefit'),
    (select id from validator_selection_ids where key = 'owner_membership'),
    (select id from validator_selection_ids where key = 'finance1_membership')
  ) is not null,
  'validation assignments are created atomically with benefit submission'
);

select is(
  (
    select count(*)::integer
    from public.benefit_validation_assignments assignment_row
    where assignment_row.benefit_id = (select id from validator_selection_ids where key = 'third_financial_benefit')
      and assignment_row.status = 'active'
  ),
  2,
  'submitted benefit has CI and finance validation assignments'
);

select * from finish();

rollback;
