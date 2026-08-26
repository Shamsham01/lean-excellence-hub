begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b6000000-0000-0000-0000-000000000001',
  'benefit-realisation-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b6000000-0000-0000-0000-000000000002',
  'benefit-realisation-validator@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table realisation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on realisation_ids to authenticated;

insert into realisation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b6000000-0000-0000-0000-000000000001',
    'benefit-realisation-org',
    'Benefit Realisation Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b6100000-0000-0000-0000-000000000001',
  'b6000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b6100000-0000-0000-0000-000000000002',
  'b6000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b6000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b6100000-0000-0000-0000-000000000001","email":"benefit-realisation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from realisation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into realisation_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from realisation_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into realisation_ids (key, id)
select 'benefit', public.create_benefit_draft(
  'Realisation tracking benefit',
  (select id from realisation_ids where key = 'unit_root'),
  'financial',
  'Track realised savings',
  'hard_saving',
  null,
  null,
  null,
  true
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
    (select id from realisation_ids where key = 'organisation'),
    'b6000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into realisation_ids (key, id)
select 'validator_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b6000000-0000-0000-0000-000000000002';

update public.improvement_benefits benefit_table
set status = 'realising'
where benefit_table.id = (select id from realisation_ids where key = 'benefit');

select set_config(
  'request.jwt.claims',
  '{"sub":"b6000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b6100000-0000-0000-0000-000000000001","email":"benefit-realisation-owner@example.test"}',
  true
);
set local role authenticated;

insert into realisation_ids (key, id)
select 'validator_role_version', public.create_role_draft(
  (select id from realisation_ids where key = 'organisation'),
  'benefit-realisation-validator',
  'Benefit Realisation Validator',
  'Validate realised benefit entries'
);

select ok(
  public.add_role_permission(
    (select id from realisation_ids where key = 'organisation'),
    (select id from realisation_ids where key = 'validator_role_version'),
    'benefits.realisation.validate'
  ),
  'validator role receives realisation validate permission'
);

select ok(
  public.publish_role_version(
    (select id from realisation_ids where key = 'organisation'),
    (select id from realisation_ids where key = 'validator_role_version')
  ),
  'validator role publishes'
);

insert into realisation_ids (key, id)
select 'validator_grant', public.grant_role_version(
  (select id from realisation_ids where key = 'organisation'),
  (select id from realisation_ids where key = 'validator_membership'),
  (select id from realisation_ids where key = 'validator_role_version'),
  'organisation',
  null
);

insert into realisation_ids (key, id)
select 'original_entry', public.create_benefit_realisation_entry(
  (select id from realisation_ids where key = 'benefit'),
  '2026-01-01'::date,
  '2026-03-31'::date,
  5000,
  null,
  null,
  'utility bill',
  'Q1 original entry'
);

insert into realisation_ids (key, id)
select 'draft_entry', public.create_benefit_realisation_entry(
  (select id from realisation_ids where key = 'benefit'),
  '2026-04-01'::date,
  '2026-06-30'::date,
  2500,
  null,
  null,
  'utility bill',
  'Q2 draft entry'
);

select ok(
  public.submit_benefit_realisation_entry((select id from realisation_ids where key = 'original_entry')),
  'original entry submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b6000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b6100000-0000-0000-0000-000000000002","email":"benefit-realisation-validator@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from realisation_ids where key = 'organisation')),
  'validator selects organisation'
);

select ok(
  public.validate_benefit_realisation_entry((select id from realisation_ids where key = 'original_entry')),
  'validator validates original entry'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b6000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b6100000-0000-0000-0000-000000000001","email":"benefit-realisation-owner@example.test"}',
  true
);

select is(
  (
    select (public.get_benefit_detail((select id from realisation_ids where key = 'benefit'))
      ->> 'validated_realised_total')::numeric
  ),
  5000::numeric,
  'validated totals include validated entries only'
);

select throws_ok(
  format(
    'select public.create_benefit_realisation_adjustment(%L::uuid, %s, null, null, null, null, null, %L, true)',
    (select id from realisation_ids where key = 'original_entry'),
    500,
    'Positive correction should fail'
  ),
  'correction adjustments require a negative signed delta',
  '22023'
);

insert into realisation_ids (key, id)
select 'adjustment_entry', public.create_benefit_realisation_adjustment(
  (select id from realisation_ids where key = 'original_entry'),
  -500,
  null,
  null,
  null,
  null,
  null,
  'Correction for overstatement',
  true
);

select ok(
  public.submit_benefit_realisation_entry((select id from realisation_ids where key = 'adjustment_entry')),
  'signed correction adjustment submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b6000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b6100000-0000-0000-0000-000000000002","email":"benefit-realisation-validator@example.test"}',
  true
);

select ok(
  public.validate_benefit_realisation_entry((select id from realisation_ids where key = 'adjustment_entry')),
  'validator validates correction adjustment'
);

reset role;

select throws_ok(
  format(
    'update public.benefit_realisation_entries set notes = %L where id = %L',
    'Changed notes',
    (select id from realisation_ids where key = 'original_entry')
  ),
  'validated realisation entry is immutable',
  '55000'
);

select * from finish();
rollback;
