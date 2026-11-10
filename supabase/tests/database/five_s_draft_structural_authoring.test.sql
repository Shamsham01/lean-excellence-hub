begin;

select plan(36);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.remove_five_s_question(uuid)',
    'execute'
  ),
  'authenticated can remove a 5S draft question'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.remove_five_s_question(uuid)',
    'execute'
  ),
  'anon cannot remove a 5S draft question'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.remove_five_s_section(uuid)',
    'execute'
  ),
  'anon cannot remove a 5S draft section'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.discard_five_s_standard_draft(uuid)',
    'execute'
  ),
  'anon cannot discard a 5S draft'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('b5c10000-0000-0000-0000-000000000001', 'five-s-remove-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b5c10000-0000-0000-0000-000000000002', 'five-s-remove-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b5c10000-0000-0000-0000-000000000003', 'five-s-remove-viewer@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('b5c10000-0000-0000-0000-000000000004', 'five-s-remove-other-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table remove_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on remove_ids to authenticated;

insert into remove_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b5c10000-0000-0000-0000-000000000001',
    'five-s-remove-org',
    'Five S Remove Organisation'
  )
);

insert into remove_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'b5c10000-0000-0000-0000-000000000004',
    'five-s-remove-other-org',
    'Five S Remove Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('b5c10000-0000-0000-0000-000000000011', 'b5c10000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('b5c10000-0000-0000-0000-000000000012', 'b5c10000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('b5c10000-0000-0000-0000-000000000013', 'b5c10000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('b5c10000-0000-0000-0000-000000000014', 'b5c10000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from remove_ids where key = 'organisation'),
  'b5c10000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
),
(
  (select id from remove_ids where key = 'organisation'),
  'b5c10000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'b5c10000-0000-0000-0000-000000000002',
  'b5c10000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000011","email":"five-s-remove-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from remove_ids where key = 'organisation')),
  'owner selects the remove organisation'
);

insert into remove_ids (key, id)
select 'packing', public.create_organisation_unit(
  (select id from remove_ids where key = 'organisation'),
  null,
  'remove-packing',
  'Packing',
  'department'
);

insert into remove_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Remove test',
  'Draft structural authoring',
  80,
  array[(select id from remove_ids where key = 'packing')]
);

insert into remove_ids (key, id)
select 'v1', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from remove_ids where key = 'standard');

insert into remove_ids (key, id)
select 'sort_section', public.add_five_s_section(
  (select id from remove_ids where key = 'v1'),
  'Sort',
  1
);

insert into remove_ids (key, id)
select 'set_section', public.add_five_s_section(
  (select id from remove_ids where key = 'v1'),
  'Set',
  2
);

select public.add_five_s_question(
  (select id from remove_ids where key = 'v1'),
  (select id from remove_ids where key = 'sort_section'),
  'yes_no',
  'Sort question keep',
  1,
  true,
  false,
  null,
  null,
  true,
  '{"type":"yes_no","yes_value":100,"no_value":0}'::jsonb,
  1
);

insert into remove_ids (key, id)
select 'remove_question', question_row.id
from public.template_questions question_row
where question_row.prompt = 'Sort question keep';

select public.add_five_s_question(
  (select id from remove_ids where key = 'v1'),
  (select id from remove_ids where key = 'sort_section'),
  'short_text',
  'Sort question drop',
  2
);

insert into remove_ids (key, id)
select 'drop_question', question_row.id
from public.template_questions question_row
where question_row.prompt = 'Sort question drop';

select public.add_five_s_question(
  (select id from remove_ids where key = 'v1'),
  (select id from remove_ids where key = 'set_section'),
  'short_text',
  'Set question',
  1
);

select lives_ok(
  format(
    'select public.remove_five_s_question(%L::uuid)',
    (select id from remove_ids where key = 'drop_question')
  ),
  'draft question removal succeeds'
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = question_row.template_version_id
    where version_row.id = (select id from remove_ids where key = 'v1')
  ),
  2::bigint,
  'removing one question leaves the rest'
);

select public.publish_five_s_standard_version(
  (select id from remove_ids where key = 'v1')
);

insert into remove_ids (key, id)
select 'v1_audit', public.start_five_s_audit(
  (select id from remove_ids where key = 'standard'),
  (select id from remove_ids where key = 'packing')
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, ''yes'', null)',
    (select id from remove_ids where key = 'v1_audit'),
    (select id from remove_ids where key = 'remove_question')
  ),
  'v1 audit answer persists on the published question'
);

select throws_ok(
  format(
    'select public.remove_five_s_question(%L::uuid)',
    (select id from remove_ids where key = 'remove_question')
  ),
  '55000',
  '5S question is not removable',
  'published questions cannot be removed'
);

insert into remove_ids (key, id)
select 'published_set_section', section_row.id
from public.template_sections section_row
join public.five_s_standard_versions version_row
  on version_row.template_version_id = section_row.template_version_id
where version_row.id = (select id from remove_ids where key = 'v1')
  and section_row.title = 'Set';

select throws_ok(
  format(
    'select public.remove_five_s_section(%L::uuid)',
    (select id from remove_ids where key = 'published_set_section')
  ),
  '55000',
  '5S section is not removable',
  'published sections cannot be removed'
);

select lives_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from remove_ids where key = 'standard')
  ),
  'successor draft is created'
);

insert into remove_ids (key, id)
select 'v2', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from remove_ids where key = 'standard')
  and version_row.status = 'draft';

insert into remove_ids (key, id)
select 'v2_sort_section', section_row.id
from public.template_sections section_row
join public.five_s_standard_versions version_row
  on version_row.template_version_id = section_row.template_version_id
where version_row.id = (select id from remove_ids where key = 'v2')
  and section_row.title = 'Sort';

insert into remove_ids (key, id)
select 'v2_set_section', section_row.id
from public.template_sections section_row
join public.five_s_standard_versions version_row
  on version_row.template_version_id = section_row.template_version_id
where version_row.id = (select id from remove_ids where key = 'v2')
  and section_row.title = 'Set';

insert into remove_ids (key, id)
select 'v2_keep_question', question_row.id
from public.template_questions question_row
join public.five_s_standard_versions version_row
  on version_row.template_version_id = question_row.template_version_id
where version_row.id = (select id from remove_ids where key = 'v2')
  and question_row.prompt = 'Sort question keep';

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000003","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000013","email":"five-s-remove-viewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from remove_ids where key = 'organisation')),
  'viewer selects the organisation'
);

select throws_ok(
  format(
    'select public.remove_five_s_question(%L::uuid)',
    (select id from remove_ids where key = 'v2_keep_question')
  ),
  '42501',
  '5S question removal is not authorised',
  'non-managers cannot remove draft questions'
);

select throws_ok(
  format(
    'select public.remove_five_s_section(%L::uuid)',
    (select id from remove_ids where key = 'v2_set_section')
  ),
  '42501',
  '5S section removal is not authorised',
  'non-managers cannot remove draft sections'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000011","email":"five-s-remove-owner@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from remove_ids where key = 'standard')
  ),
  '55000',
  '5S standard already has a draft version',
  'successor creation stays blocked while draft exists'
);

select lives_ok(
  format(
    'select public.remove_five_s_section(%L::uuid)',
    (select id from remove_ids where key = 'v2_set_section')
  ),
  'a cloned category can be removed from successor draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000003","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000013","email":"five-s-remove-viewer@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.discard_five_s_standard_draft(%L::uuid)',
    (select id from remove_ids where key = 'v2')
  ),
  '42501',
  '5S draft discard is not authorised',
  'non-managers cannot discard a successor draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000011","email":"five-s-remove-owner@example.test"}',
  true
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from remove_ids where key = 'v2')
  ),
  'successor publishes after structural removal'
);

select is(
  (
    select count(*)
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from remove_ids where key = 'v1_audit')
      and answer_row.question_id = (select id from remove_ids where key = 'remove_question')
  ),
  1::bigint,
  'v1 audit history still references the original published question'
);

insert into remove_ids (key, id)
select 'v2_audit', public.start_five_s_audit(
  (select id from remove_ids where key = 'standard'),
  (select id from remove_ids where key = 'packing')
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = question_row.template_version_id
    join public.five_s_audits audit_row
      on audit_row.standard_version_id = version_row.id
    where audit_row.id = (select id from remove_ids where key = 'v2_audit')
  ),
  1::bigint,
  'a new audit uses v2 with the removed clone absent'
);

insert into remove_ids (key, id)
select 'discard_standard', public.create_five_s_standard_draft(
  'Discard only',
  null,
  80,
  array[(select id from remove_ids where key = 'packing')]
);

insert into remove_ids (key, id)
select 'discard_only_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from remove_ids where key = 'discard_standard');

select throws_ok(
  format(
    'select public.discard_five_s_standard_draft(%L::uuid)',
    (select id from remove_ids where key = 'discard_only_version')
  ),
  '55000',
  '5S standard requires at least one version',
  'sole never-published draft cannot be discarded'
);

select lives_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from remove_ids where key = 'standard')
  ),
  'a third successor draft opens after v2 is published'
);

insert into remove_ids (key, id)
select 'v3', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from remove_ids where key = 'standard')
  and version_row.status = 'draft';

insert into remove_ids (key, id)
select 'v3_template', version_row.template_version_id
from public.five_s_standard_versions version_row
where version_row.id = (select id from remove_ids where key = 'v3');

select lives_ok(
  format(
    'select public.discard_five_s_standard_draft(%L::uuid)',
    (select id from remove_ids where key = 'v3')
  ),
  'successor draft can be discarded when a published version remains'
);

select is(
  (
    select count(*)
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from remove_ids where key = 'v3')
  ),
  0::bigint,
  'discard removes the standard version row'
);

select is(
  (
    select count(*)
    from public.template_versions template_row
    where template_row.id = (select id from remove_ids where key = 'v3_template')
  ),
  0::bigint,
  'discard removes the template version row'
);

select is(
  (
    select count(*)
    from public.five_s_question_scoring scoring_row
    where scoring_row.standard_version_id = (select id from remove_ids where key = 'v3')
  ),
  0::bigint,
  'discard removes question scoring rows'
);

select is(
  (
    select count(*)
    from public.five_s_section_weights weight_row
    where weight_row.standard_version_id = (select id from remove_ids where key = 'v3')
  ),
  0::bigint,
  'discard removes section weight rows'
);

select lives_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from remove_ids where key = 'standard')
  ),
  'discarding the draft re-enables successor creation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000011","email":"five-s-remove-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from remove_ids where key = 'organisation')),
  'owner re-selects primary org before cross-tenant probe'
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    where question_row.id = (select id from remove_ids where key = 'v2_keep_question')
  ),
  1::bigint,
  'primary org question exists before cross-tenant probe'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000004","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000014","email":"five-s-remove-other-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from remove_ids where key = 'other_organisation')),
  'other organisation owner selects their org'
);

select throws_ok(
  format(
    'select public.remove_five_s_question(%L::uuid)',
    (select id from remove_ids where key = 'v2_keep_question')
  ),
  '55000',
  '5S question is not removable',
  'other organisation cannot remove a foreign question'
);

select throws_ok(
  format(
    'select public.remove_five_s_section(%L::uuid)',
    (select id from remove_ids where key = 'v2_sort_section')
  ),
  '55000',
  '5S section is not removable',
  'other organisation cannot remove a foreign section'
);

select throws_ok(
  format(
    'select public.discard_five_s_standard_draft(%L::uuid)',
    (select id from remove_ids where key = 'v2')
  ),
  'P0002',
  '5S draft version was not found',
  'other organisation cannot discard a foreign draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b5c10000-0000-0000-0000-000000000011","email":"five-s-remove-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from remove_ids where key = 'organisation')),
  'owner re-selects primary org after cross-tenant probe'
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    where question_row.id = (select id from remove_ids where key = 'v2_keep_question')
  ),
  1::bigint,
  'foreign structural RPC probes leave rows unchanged'
);

select * from finish();
rollback;
