begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1d00000-0000-0000-0000-000000000001',
  'ps-evidence-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1d00000-0000-0000-0000-000000000003',
  'ps-evidence-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_evidence_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_evidence_ids to authenticated;

insert into ps_evidence_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1d00000-0000-0000-0000-000000000001',
    'ps-evidence-org',
    'Problem Solving Evidence Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1d10000-0000-0000-0000-000000000001',
  'a1d00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1d10000-0000-0000-0000-000000000003',
  'a1d00000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1d00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1d10000-0000-0000-0000-000000000001","email":"ps-evidence-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_evidence_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_evidence_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_evidence_ids where key = 'organisation'),
  null,
  'evidence-site',
  'Evidence Site',
  'site'
);

insert into ps_evidence_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_evidence_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_evidence_ids (key, id)
select 'case_a', public.create_problem_solving_case_draft(
  'Evidence case A',
  (select id from ps_evidence_ids where key = 'unit_root')
);

insert into ps_evidence_ids (key, id)
select 'case_b', public.create_problem_solving_case_draft(
  'Evidence case B',
  (select id from ps_evidence_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_evidence_ids where key = 'case_a'),
    (select id from ps_evidence_ids where key = 'rapid_method')
  ),
  'case A activates'
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_evidence_ids where key = 'case_b'),
    (select id from ps_evidence_ids where key = 'rapid_method')
  ),
  'case B activates'
);

insert into ps_evidence_ids (key, id)
select 'condition_item', public.create_current_condition_item(
  (select id from ps_evidence_ids where key = 'case_a'),
  'observation',
  'Gauge reading captured during failure'
);

insert into ps_evidence_ids (key, id)
select 'hypothesis', public.create_hypothesis(
  (select id from ps_evidence_ids where key = 'case_a'),
  'Fixture wear causes misalignment'
);

select ok(
  public.update_hypothesis_status(
    (select id from ps_evidence_ids where key = 'hypothesis'),
    'supported',
    'Team agrees this is the leading hypothesis'
  ),
  'hypothesis advances to supported for evidence verification test'
);

insert into ps_evidence_ids (key, id)
select 'attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from ps_evidence_ids where key = 'case_a'),
  'gauge-reading.pdf',
  'application/pdf',
  2048
) upload_row;

select ok(
  public.confirm_attachment_upload((select id from ps_evidence_ids where key = 'attachment')),
  'case attachment upload is confirmed'
);

select ok(
  exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.id = (select id from ps_evidence_ids where key = 'attachment')
      and attachment_row.organisation_id = (select id from ps_evidence_ids where key = 'organisation')
      and attachment_row.lifecycle = 'active'
  ),
  'confirmed attachment is active in organisation before evidence linking'
);

insert into ps_evidence_ids (key, id)
select 'evidence_link', public.link_problem_solving_evidence(
  (select id from ps_evidence_ids where key = 'case_a'),
  (select id from ps_evidence_ids where key = 'attachment'),
  (select id from ps_evidence_ids where key = 'condition_item'),
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  false,
  'Gauge photo supports observation'
);

select throws_ok(
  format(
    'select public.link_problem_solving_evidence(%L::uuid, %L::uuid, null, null, %L::uuid, null, null, null, null, null, null, false, null)',
    (select id from ps_evidence_ids where key = 'case_b'),
    (select id from ps_evidence_ids where key = 'attachment'),
    (select id from ps_evidence_ids where key = 'hypothesis')
  ),
  'hypothesis does not belong to this case',
  '22023'
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    (select id from ps_evidence_ids where key = 'hypothesis'),
    'Attachment alone should not verify cause'
  ),
  'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale',
  '55000'
);

reset role;

insert into ps_evidence_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'a1d00000-0000-0000-0000-000000000003',
    'ps-evidence-org-b',
    'Problem Solving Evidence Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1d00000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1d10000-0000-0000-0000-000000000003","email":"ps-evidence-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_evidence_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.link_problem_solving_evidence(%L::uuid, %L::uuid, null, null, null, null, null, null, null, null, null, true, null)',
    (select id from ps_evidence_ids where key = 'case_a'),
    (select id from ps_evidence_ids where key = 'attachment')
  ),
  'problem solving case not found',
  'P0002'
);

select ok(
  not exists (
    select 1
    from public.problem_solving_evidence_links evidence_row
    where evidence_row.id = (select id from ps_evidence_ids where key = 'evidence_link')
  ),
  'cross-tenant user cannot read evidence links from another organisation'
);

select * from finish();
rollback;
