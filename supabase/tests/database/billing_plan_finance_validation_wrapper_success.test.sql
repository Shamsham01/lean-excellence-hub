begin;

select plan(25);

-- ---------------------------------------------------------------------------
-- Professional subscription: public wrapper must reach private helper.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b2200000-0000-4000-8000-000000000001',
    'plan-fin-pro-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b2200000-0000-4000-8000-000000000002',
    'plan-fin-pro-finance@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table pro_wrapper_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on pro_wrapper_ids to authenticated;

insert into pro_wrapper_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2200000-0000-4000-8000-000000000001',
    'plan-fin-pro-org',
    'Plan Finance Professional Organisation'
  )
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from pro_wrapper_ids where key = 'organisation'),
    'fake',
    'cus_plan_fin_pro_w',
    'sub_plan_fin_pro_w',
    'professional',
    'monthly',
    1,
    'price_fake_professional_fin_w',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-11-08 13:00:00+00'
  ),
  'applied',
  'professional subscription applies for wrapper success org'
);

select ok(
  private.organisation_plan_capability(
    (select id from pro_wrapper_ids where key = 'organisation'),
    'advanced_benefits_governance'
  ),
  'professional organisation grants finance governance capability'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'b2210000-0000-4000-8000-000000000001',
    'b2200000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b2210000-0000-4000-8000-000000000002',
    'b2200000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"b2200000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2210000-0000-4000-8000-000000000001","email":"plan-fin-pro-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from pro_wrapper_ids where key = 'organisation')),
  'professional owner selects organisation'
);

insert into pro_wrapper_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from pro_wrapper_ids where key = 'organisation'),
  null,
  'pro-wrapper-site',
  'Pro Wrapper Site',
  'site'
);

insert into pro_wrapper_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from pro_wrapper_ids where key = 'organisation')
  and membership_row.user_id = 'b2200000-0000-4000-8000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from pro_wrapper_ids where key = 'organisation'),
    'b2200000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into pro_wrapper_ids (key, id)
select 'finance_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b2200000-0000-4000-8000-000000000002';

insert into pro_wrapper_ids (key, id)
select 'finance_role_version', public.create_role_draft(
  (select id from pro_wrapper_ids where key = 'organisation'),
  'pro-wrapper-finance',
  'Pro Wrapper Finance',
  'Finance validation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2200000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2210000-0000-4000-8000-000000000001","email":"plan-fin-pro-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_role_permission(
    (select id from pro_wrapper_ids where key = 'organisation'),
    (select id from pro_wrapper_ids where key = 'finance_role_version'),
    'benefits.validate.finance'
  ),
  'professional finance role receives finance validation permission'
);

select ok(
  public.publish_role_version(
    (select id from pro_wrapper_ids where key = 'organisation'),
    (select id from pro_wrapper_ids where key = 'finance_role_version')
  ),
  'professional finance role publishes'
);

insert into pro_wrapper_ids (key, id)
select 'finance_grant', public.grant_role_version(
  (select id from pro_wrapper_ids where key = 'organisation'),
  (select id from pro_wrapper_ids where key = 'finance_membership'),
  (select id from pro_wrapper_ids where key = 'finance_role_version'),
  'organisation',
  null
);

insert into pro_wrapper_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Professional wrapper savings',
  (select id from pro_wrapper_ids where key = 'unit_root'),
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
    (select id from pro_wrapper_ids where key = 'financial_benefit'),
    'Professional wrapper savings',
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
  'professional financial draft accepts baseline'
);

insert into pro_wrapper_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from pro_wrapper_ids where key = 'financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  40000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from pro_wrapper_ids where key = 'forecast_version'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-12-31',
        'forecast_amount', 40000,
        'display_order', 1
      )
    )
  ),
  'professional forecast periods align'
);

select ok(
  public.submit_benefit_forecast((select id from pro_wrapper_ids where key = 'forecast_version')),
  'professional forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from pro_wrapper_ids where key = 'financial_benefit'),
    (select id from pro_wrapper_ids where key = 'owner_membership'),
    (select id from pro_wrapper_ids where key = 'finance_membership')
  ) is not null,
  'professional benefit submits with distinct CI and finance validators'
);

select ok(
  public.record_benefit_validation(
    (select id from pro_wrapper_ids where key = 'financial_benefit'),
    'ci',
    'approve',
    'CI validation on professional'
  ) is not null,
  'professional CI validation via public wrapper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2200000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b2210000-0000-4000-8000-000000000002","email":"plan-fin-pro-finance@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from pro_wrapper_ids where key = 'organisation')),
  'professional finance validator selects organisation'
);

select ok(
  public.record_benefit_validation(
    (select id from pro_wrapper_ids where key = 'financial_benefit'),
    'finance',
    'approve',
    'Finance validation on professional via public wrapper'
  ) is not null,
  'professional finance validation succeeds through public wrapper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2200000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2210000-0000-4000-8000-000000000001","email":"plan-fin-pro-owner@example.test"}',
  true
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from pro_wrapper_ids where key = 'financial_benefit')),
  'approved',
  'professional financial benefit approved after finance wrapper call'
);

-- ---------------------------------------------------------------------------
-- Legacy / no subscription: capability defaults open; wrapper must still work.
-- ---------------------------------------------------------------------------

reset role;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b2220000-0000-4000-8000-000000000001',
    'plan-fin-legacy-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b2220000-0000-4000-8000-000000000002',
    'plan-fin-legacy-finance@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table legacy_wrapper_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on legacy_wrapper_ids to authenticated;

insert into legacy_wrapper_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2220000-0000-4000-8000-000000000001',
    'plan-fin-legacy-org',
    'Plan Finance Legacy Organisation'
  )
);

select ok(
  private.organisation_plan_capability(
    (select id from legacy_wrapper_ids where key = 'organisation'),
    'advanced_benefits_governance'
  ),
  'legacy organisation without subscription keeps finance governance capability'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'b2230000-0000-4000-8000-000000000001',
    'b2220000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b2230000-0000-4000-8000-000000000002',
    'b2220000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"b2220000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2230000-0000-4000-8000-000000000001","email":"plan-fin-legacy-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from legacy_wrapper_ids where key = 'organisation')),
  'legacy owner selects organisation'
);

insert into legacy_wrapper_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from legacy_wrapper_ids where key = 'organisation'),
  null,
  'legacy-wrapper-site',
  'Legacy Wrapper Site',
  'site'
);

insert into legacy_wrapper_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from legacy_wrapper_ids where key = 'organisation')
  and membership_row.user_id = 'b2220000-0000-4000-8000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from legacy_wrapper_ids where key = 'organisation'),
    'b2220000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into legacy_wrapper_ids (key, id)
select 'finance_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b2220000-0000-4000-8000-000000000002';

insert into legacy_wrapper_ids (key, id)
select 'finance_role_version', public.create_role_draft(
  (select id from legacy_wrapper_ids where key = 'organisation'),
  'legacy-wrapper-finance',
  'Legacy Wrapper Finance',
  'Finance validation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2220000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2230000-0000-4000-8000-000000000001","email":"plan-fin-legacy-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.add_role_permission(
    (select id from legacy_wrapper_ids where key = 'organisation'),
    (select id from legacy_wrapper_ids where key = 'finance_role_version'),
    'benefits.validate.finance'
  ),
  'legacy finance role receives finance validation permission'
);

select ok(
  public.publish_role_version(
    (select id from legacy_wrapper_ids where key = 'organisation'),
    (select id from legacy_wrapper_ids where key = 'finance_role_version')
  ),
  'legacy finance role publishes'
);

insert into legacy_wrapper_ids (key, id)
select 'finance_grant', public.grant_role_version(
  (select id from legacy_wrapper_ids where key = 'organisation'),
  (select id from legacy_wrapper_ids where key = 'finance_membership'),
  (select id from legacy_wrapper_ids where key = 'finance_role_version'),
  'organisation',
  null
);

insert into legacy_wrapper_ids (key, id)
select 'financial_benefit', public.create_benefit_draft(
  'Legacy wrapper savings',
  (select id from legacy_wrapper_ids where key = 'unit_root'),
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
    (select id from legacy_wrapper_ids where key = 'financial_benefit'),
    'Legacy wrapper savings',
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
  'legacy financial draft accepts baseline'
);

insert into legacy_wrapper_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from legacy_wrapper_ids where key = 'financial_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-12-31'::date,
  40000
);

select ok(
  public.replace_benefit_forecast_periods(
    (select id from legacy_wrapper_ids where key = 'forecast_version'),
    jsonb_build_array(
      jsonb_build_object(
        'period_start', '2026-01-01',
        'period_end', '2026-12-31',
        'forecast_amount', 40000,
        'display_order', 1
      )
    )
  ),
  'legacy forecast periods align'
);

select ok(
  public.submit_benefit_forecast((select id from legacy_wrapper_ids where key = 'forecast_version')),
  'legacy forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from legacy_wrapper_ids where key = 'financial_benefit'),
    (select id from legacy_wrapper_ids where key = 'owner_membership'),
    (select id from legacy_wrapper_ids where key = 'finance_membership')
  ) is not null,
  'legacy benefit submits with distinct CI and finance validators'
);

select ok(
  public.record_benefit_validation(
    (select id from legacy_wrapper_ids where key = 'financial_benefit'),
    'ci',
    'approve',
    'CI validation on legacy org'
  ) is not null,
  'legacy CI validation via public wrapper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2220000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b2230000-0000-4000-8000-000000000002","email":"plan-fin-legacy-finance@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from legacy_wrapper_ids where key = 'organisation')),
  'legacy finance validator selects organisation'
);

select ok(
  public.record_benefit_validation(
    (select id from legacy_wrapper_ids where key = 'financial_benefit'),
    'finance',
    'approve',
    'Finance validation on legacy org via public wrapper'
  ) is not null,
  'legacy finance validation succeeds through public wrapper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2220000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2230000-0000-4000-8000-000000000001","email":"plan-fin-legacy-owner@example.test"}',
  true
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from legacy_wrapper_ids where key = 'financial_benefit')),
  'approved',
  'legacy financial benefit approved after finance wrapper call'
);

select * from finish();

rollback;
