begin;

select plan(19);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2000000-0000-0000-0000-000000000001',
  'benefit-lifecycle-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on lifecycle_ids to authenticated;

insert into lifecycle_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2000000-0000-0000-0000-000000000001',
    'benefit-lifecycle-org',
    'Benefit Lifecycle Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2100000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2100000-0000-0000-0000-000000000001","email":"benefit-lifecycle-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into lifecycle_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from lifecycle_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into lifecycle_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from lifecycle_ids where key = 'organisation')
  and membership_row.user_id = 'b2000000-0000-0000-0000-000000000001';

insert into lifecycle_ids (key, id)
select 'benefit', public.create_benefit_draft(
  'Lifecycle benefit',
  (select id from lifecycle_ids where key = 'unit_root'),
  'non_financial',
  'Track delivery reliability',
  null,
  'delivery',
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from lifecycle_ids where key = 'benefit'),
    'Lifecycle benefit',
    'Track delivery reliability',
    'non_financial',
    null,
    'delivery',
    null,
    null,
    null,
    'Baseline on-time rate',
    null,
    null,
    82,
    'percent',
    null,
    null,
    null,
    null
  ),
  'non-financial draft accepts baseline measure'
);

insert into lifecycle_ids (key, id)
select 'forecast_version', public.create_benefit_forecast_draft(
  (select id from lifecycle_ids where key = 'benefit'),
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
  public.submit_benefit_forecast((select id from lifecycle_ids where key = 'forecast_version')),
  'forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from lifecycle_ids where key = 'benefit'),
    (select id from lifecycle_ids where key = 'owner_membership'),
    null
  ) is not null,
  'draft benefit submits'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from lifecycle_ids where key = 'benefit')),
  'submitted',
  'submit transitions benefit to submitted'
);

select throws_ok(
  format(
    'select public.update_benefit_draft(%L::uuid, %L)',
    (select id from lifecycle_ids where key = 'benefit'),
    'Changed title'
  ),
  'benefit is not editable',
  '55000'
);

select throws_ok(
  format(
    'select public.start_benefit_realisation(%L::uuid)',
    (select id from lifecycle_ids where key = 'benefit')
  ),
  'benefit cannot start realisation',
  '55000'
);

select ok(
  public.record_benefit_validation(
    (select id from lifecycle_ids where key = 'benefit'),
    'ci',
    'approve',
    'CI validation complete'
  ) is not null,
  'CI approval advances validation'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from lifecycle_ids where key = 'benefit')),
  'approved',
  'CI approval transitions non-financial benefit to approved'
);

select ok(
  public.start_benefit_realisation((select id from lifecycle_ids where key = 'benefit')),
  'approved benefit starts realisation'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from lifecycle_ids where key = 'benefit')),
  'realising',
  'start transitions benefit to realising'
);

select ok(
  public.mark_benefit_realised(
    (select id from lifecycle_ids where key = 'benefit'),
    'Target on-time rate sustained'
  ),
  'realising benefit completes'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from lifecycle_ids where key = 'benefit')),
  'realised',
  'mark realised transitions benefit to realised'
);

insert into lifecycle_ids (key, id)
select 'return_benefit', public.create_benefit_draft(
  'Return to draft benefit',
  (select id from lifecycle_ids where key = 'unit_root'),
  'non_financial',
  'Temporary draft for return flow',
  null,
  'quality',
  null,
  null,
  true
);

select ok(
  public.update_benefit_draft(
    (select id from lifecycle_ids where key = 'return_benefit'),
    'Return to draft benefit',
    'Temporary draft for return flow',
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
  'return-flow draft accepts baseline description'
);

insert into lifecycle_ids (key, id)
select 'return_forecast', public.create_benefit_forecast_draft(
  (select id from lifecycle_ids where key = 'return_benefit'),
  'one_off',
  '2026-01-01'::date,
  '2026-06-30'::date,
  null,
  null,
  null,
  1,
  'defects',
  '2026-06-30'::date
);

select ok(
  public.submit_benefit_forecast((select id from lifecycle_ids where key = 'return_forecast')),
  'return-flow forecast submits'
);

select ok(
  public.submit_benefit(
    (select id from lifecycle_ids where key = 'return_benefit'),
    (select id from lifecycle_ids where key = 'owner_membership'),
    null
  ) is not null,
  'return-flow benefit submits'
);

select ok(
  public.return_benefit_to_draft(
    (select id from lifecycle_ids where key = 'return_benefit'),
    'Needs forecast revision'
  ),
  'submitted benefit returns to draft'
);

select is(
  (select status from public.improvement_benefits
   where id = (select id from lifecycle_ids where key = 'return_benefit')),
  'draft',
  'return to draft unlocks benefit editing'
);

select is(
  (
    select lifecycle
    from public.benefit_forecast_versions
    where id = (select id from lifecycle_ids where key = 'return_forecast')
  ),
  'draft',
  'return to draft reopens submitted forecast version'
);

select * from finish();
rollback;
