begin;

select plan(62);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('f1000000-0000-0000-0000-000000000001', 'site-scope-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000002', 'site-scope-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000003', 'site-scope-auditor@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000004', 'site-scope-site-b-lead@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000005', 'site-scope-org-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table site_scope_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on site_scope_ids to authenticated;

insert into site_scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'site-scope-org',
    'Site Scope Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000005', statement_timestamp(), statement_timestamp());

insert into site_scope_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000001'::uuid;

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000002'::uuid,
    'active',
    statement_timestamp()
  ),
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000003'::uuid,
    'active',
    statement_timestamp()
  ),
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000004'::uuid,
    'active',
    statement_timestamp()
  ),
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000005'::uuid,
    'active',
    statement_timestamp()
  );

insert into site_scope_ids (key, id)
select 'manager_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000002'::uuid;

insert into site_scope_ids (key, id)
select 'auditor_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000003'::uuid;

insert into site_scope_ids (key, id)
select 'site_b_lead_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000004'::uuid;

insert into site_scope_ids (key, id)
select 'org_manager_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000005'::uuid;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000003',
  'f1000000-0000-0000-0000-000000000004',
  'f1000000-0000-0000-0000-000000000005'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner switches organisation before hierarchy setup'
);

insert into site_scope_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  null,
  'site-a',
  'Site A',
  'site'
);

insert into site_scope_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into site_scope_ids (key, id)
select 'area_a', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  (select id from site_scope_ids where key = 'site_a'),
  'area-a',
  'Area A',
  'department'
);

insert into site_scope_ids (key, id)
select 'area_b', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  (select id from site_scope_ids where key = 'site_b'),
  'area-b',
  'Area B',
  'department'
);

insert into site_scope_ids (key, id)
select 'cross_site_standard', public.create_five_s_standard_draft(
  'Cross-site standard',
  'Applies to both sites',
  90,
  array[
    (select id from site_scope_ids where key = 'area_a'),
    (select id from site_scope_ids where key = 'area_b')
  ]::uuid[]
);

insert into site_scope_ids (key, id)
select 'site_a_standard', public.create_five_s_standard_draft(
  'Site A standard',
  'Site A only',
  90,
  array[(select id from site_scope_ids where key = 'area_a')]::uuid[]
);

insert into site_scope_ids (key, id)
select 'site_a_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from site_scope_ids where key = 'site_a_standard')
  and version_row.version_number = 1;

insert into site_scope_ids (key, id)
select 'no_location_standard', public.create_five_s_standard_draft(
  'No locations yet',
  'Draft without applicability',
  90,
  null
);

insert into site_scope_ids (key, id)
select 'site_b_standard', public.create_five_s_standard_draft(
  'Site B standard',
  'Site B only',
  90,
  array[(select id from site_scope_ids where key = 'area_b')]::uuid[]
);

insert into site_scope_ids (key, id)
select 'cross_site_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from site_scope_ids where key = 'cross_site_standard')
  and version_row.version_number = 1;

insert into site_scope_ids (key, id)
select 'cross_site_template_version', version_row.template_version_id
from public.five_s_standard_versions version_row
where version_row.id = (select id from site_scope_ids where key = 'cross_site_version');

insert into site_scope_ids (key, id)
select 'site_a_gemba', public.create_gemba_definition_draft(
  'Site A gemba',
  'Gemba A only',
  30,
  array[(select id from site_scope_ids where key = 'area_a')]::uuid[]
);

insert into site_scope_ids (key, id)
select 'site_b_gemba', public.create_gemba_definition_draft(
  'Site B gemba',
  'Gemba B only',
  30,
  array[(select id from site_scope_ids where key = 'area_b')]::uuid[]
);

insert into site_scope_ids (key, id)
select 'site_a_gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from site_scope_ids where key = 'site_a_gemba')
  and version_row.version_number = 1;

insert into site_scope_ids (key, id)
select 'site_b_gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from site_scope_ids where key = 'site_b_gemba')
  and version_row.version_number = 1;

select ok(
  (select count(*) from public.five_s_standards) >= 4,
  'owner seeds standards'
);

insert into site_scope_ids (key, id)
select 'five_s_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'five_s'
  and role_version.status = 'published';

insert into site_scope_ids (key, id)
select 'gemba_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'gemba'
  and role_version.status = 'published';

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'manager_membership'),
    (select id from site_scope_ids where key = 'five_s_role_version'),
    'unit_subtree',
    (select id from site_scope_ids where key = 'site_a')
  ) is not null,
  'site manager receives unit-scoped 5S responsibility'
);

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'manager_membership'),
    (select id from site_scope_ids where key = 'gemba_role_version'),
    'unit_subtree',
    (select id from site_scope_ids where key = 'site_a')
  ) is not null,
  'site manager receives unit-scoped gemba responsibility'
);

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'auditor_membership'),
    (select id from site_scope_ids where key = 'five_s_role_version'),
    'organisation',
    null
  ) is not null,
  'org-wide reader receives five_s access without a home site placement'
);

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'site_b_lead_membership'),
    (select id from site_scope_ids where key = 'five_s_role_version'),
    'unit_subtree',
    (select id from site_scope_ids where key = 'site_b')
  ) is not null,
  'site B lead receives unit-scoped five_s responsibility on site B'
);

insert into site_scope_ids (key, id)
select 'job_function', public.create_job_function(
  'Site CI Manager',
  'site-ci-manager'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_scope_ids where key = 'manager_membership'),
    (select id from site_scope_ids where key = 'job_function'),
    true,
    (select id from site_scope_ids where key = 'area_a')
  ) is not null,
  'manager placed on site A area'
);

select ok(
  public.assign_membership_job_function(
    (select id from site_scope_ids where key = 'site_b_lead_membership'),
    (select id from site_scope_ids where key = 'job_function'),
    true,
    (select id from site_scope_ids where key = 'area_a')
  ) is not null,
  'site B lead primary placement remains on site A area'
);

insert into site_scope_ids (key, id)
select 'finance_validator_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and role_row.canonical_name = 'finance-validator'
  and role_version.status = 'published';

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'org_manager_membership'),
    (select id from site_scope_ids where key = 'finance_validator_role_version'),
    'organisation',
    null
  ) is not null,
  'org-wide finance-validator receives hierarchy.read without five_s manage'
);

select lives_ok(
  format(
    'select public.add_five_s_section(%L::uuid, %L, 1)',
    (select id from site_scope_ids where key = 'cross_site_version'),
    'Cross sort'
  ),
  'owner adds section on cross-site standard'
);

insert into site_scope_ids (key, id)
select 'cross_site_section', section_row.id
from public.template_sections section_row
where section_row.template_version_id = (
  select id from site_scope_ids where key = 'cross_site_template_version'
)
order by section_row.position, section_row.id
limit 1;

select lives_ok(
  format(
    $sql$
      select public.add_five_s_question(
        %1$L::uuid,
        %2$L::uuid,
        'yes_no',
        'Cross-site prompt',
        1,
        true,
        false,
        null,
        null,
        true,
        '{"type":"yes_no","yes_value":100,"no_value":0}'::jsonb,
        1
      )
    $sql$,
    (select id from site_scope_ids where key = 'cross_site_version'),
    (select id from site_scope_ids where key = 'cross_site_section')
  ),
  'owner adds question on cross-site standard'
);

insert into site_scope_ids (key, id)
select 'cross_site_question', question_row.id
from public.template_questions question_row
where question_row.template_version_id = (
  select id from site_scope_ids where key = 'cross_site_template_version'
)
order by question_row.position, question_row.id
limit 1;

select lives_ok(
  format(
    'select public.add_gemba_section(%L::uuid, %L, 1)',
    (select id from site_scope_ids where key = 'site_b_gemba_version'),
    'Site B walk'
  ),
  'owner adds gemba section on site B draft'
);

insert into site_scope_ids (key, id)
select 'site_b_gemba_template_version', version_row.template_version_id
from public.gemba_definition_versions version_row
where version_row.id = (select id from site_scope_ids where key = 'site_b_gemba_version');

insert into site_scope_ids (key, id)
select 'site_b_gemba_section', section_row.id
from public.template_sections section_row
where section_row.template_version_id = (
  select id from site_scope_ids where key = 'site_b_gemba_template_version'
)
order by section_row.position, section_row.id
limit 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000002","email":"site-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'manager switches organisation'
);

select is(
  (select count(*)::integer from public.five_s_standards where display_name = 'Cross-site standard'),
  1,
  'site manager can read cross-site standard for execution'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'cross_site_standard')
  ),
  false,
  'site manager cannot author cross-site standard'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'site_a_standard')
  ),
  true,
  'site manager can author site-local standard'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from site_scope_ids where key = 'site_a_standard'),
    (select id from site_scope_ids where key = 'area_b')
  ),
  '42501',
  'organisational unit is outside authorised site scope',
  'site manager cannot assign out-of-site unit'
);

select throws_ok(
  format(
    'select public.add_five_s_section(%L::uuid, %L, 1)',
    (select id from site_scope_ids where key = 'cross_site_version'),
    'Sort'
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot add section on cross-site standard'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_scoring_scale(%L::uuid, 1, 5, 1)',
    (select id from site_scope_ids where key = 'cross_site_version')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot change scoring on cross-site standard'
);

select throws_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_version')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot publish cross-site standard'
);

select throws_ok(
  format(
    'select public.add_gemba_section(%L::uuid, %L, 1)',
    (select id from site_scope_ids where key = 'site_b_gemba_version'),
    'Walk'
  ),
  '42501',
  'gemba definition is outside site scope',
  'site manager cannot add gemba section outside site A scope'
);

select throws_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from site_scope_ids where key = 'site_b_gemba_version')
  ),
  '42501',
  'gemba definition is outside site scope',
  'site manager cannot publish site B gemba definition'
);

select throws_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''Blocked observation'', 1)',
    (select id from site_scope_ids where key = 'site_b_gemba_version'),
    (select id from site_scope_ids where key = 'site_b_gemba_section')
  ),
  '42501',
  'gemba definition is outside site scope',
  'site manager cannot add gemba question on site B draft'
);

select throws_ok(
  format(
    $sql$
      select public.add_five_s_question(
        %1$L::uuid,
        %2$L::uuid,
        'yes_no',
        'Blocked prompt',
        2,
        true,
        false,
        null,
        null,
        true,
        '{"type":"yes_no","yes_value":100,"no_value":0}'::jsonb,
        1
      )
    $sql$,
    (select id from site_scope_ids where key = 'cross_site_version'),
    (select id from site_scope_ids where key = 'cross_site_section')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot add five_s question on cross-site standard'
);

select throws_ok(
  format(
    'select public.set_five_s_section_weight(%L::uuid, %L::uuid, 2)',
    (select id from site_scope_ids where key = 'cross_site_version'),
    (select id from site_scope_ids where key = 'cross_site_section')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot set section weight on cross-site standard'
);

select throws_ok(
  format(
    'select public.remove_five_s_question(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_question')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot remove question on cross-site standard'
);

select throws_ok(
  format(
    'select public.remove_five_s_section(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_section')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot remove section on cross-site standard'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from site_scope_ids where key = 'site_b_gemba'),
    (select id from site_scope_ids where key = 'area_b')
  ),
  '42501',
  'gemba definition is outside site scope',
  'site manager cannot set gemba locations outside site A'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        jsonb_build_object(
          'key', 'leh-workplace-5s-standard',
          'name', 'Blocked cross-site import',
          'description', 'Outside site',
          'thresholdPercent', 80,
          'scoringScale', jsonb_build_object('min', 1, 'max', 5, 'step', 1),
          'categories', jsonb_build_array(
            jsonb_build_object(
              'name', 'Sort',
              'questions', jsonb_build_array(
                jsonb_build_object(
                  'prompt', 'Sorted?',
                  'questionType', 'yes_no'
                )
              )
            )
          )
        ),
        array[%L::uuid]
      )
    $sql$,
    (select id from site_scope_ids where key = 'area_b')
  ),
  '42501',
  'organisational unit is outside authorised site scope',
  'site manager cannot create five_s draft from definition with out-of-site unit'
);

select throws_ok(
  format(
    'select public.create_five_s_standard_draft(%L, %L, 90, null)',
    'Blocked no-location draft',
    'Site manager requires applicability'
  ),
  '22023',
  'at least one applicable organisational unit is required for site-scoped authoring',
  'site-scoped manager cannot create five_s draft without applicability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner re-selects organisation to publish cross-site standard'
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_version')
  ),
  'owner publishes cross-site standard for successor guard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000002","email":"site-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'site manager re-selects organisation after cross-site publish'
);

select throws_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_standard')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot create five_s successor on cross-site standard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner re-selects organisation to open cross-site successor'
);

insert into site_scope_ids (key, id)
select 'cross_site_successor_version', public.create_five_s_standard_successor_version(
  (select id from site_scope_ids where key = 'cross_site_standard')
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''Observe'', 1)',
    (select id from site_scope_ids where key = 'site_b_gemba_version'),
    (select id from site_scope_ids where key = 'site_b_gemba_section')
  ),
  'owner adds gemba question before site B publish'
);

select lives_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from site_scope_ids where key = 'site_b_gemba_version')
  ),
  'owner publishes site B gemba for successor guard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000002","email":"site-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'site manager returns for gemba successor denial'
);

select throws_ok(
  format(
    'select public.create_gemba_definition_successor_version(%L::uuid)',
    (select id from site_scope_ids where key = 'site_b_gemba')
  ),
  '42501',
  'gemba definition is outside site scope',
  'site manager cannot create gemba successor on site B definition'
);

select throws_ok(
  format(
    'select public.discard_five_s_standard_draft(%L::uuid)',
    (select id from site_scope_ids where key = 'cross_site_successor_version')
  ),
  '42501',
  '5S standard is outside site scope',
  'site manager cannot discard cross-site successor draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner re-selects organisation for authoring checks'
);

select ok(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'cross_site_standard')
  ),
  'organisation owner can author cross-site standard'
);

select lives_ok(
  format(
    'select public.add_five_s_section(%L::uuid, %L, 10)',
    (select id from site_scope_ids where key = 'cross_site_successor_version'),
    'Owner follow-up'
  ),
  'organisation owner can add section on cross-site successor draft'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000002","email":"site-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'manager re-selects organisation after owner checks'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'no_location_standard')
  ),
  false,
  'site manager cannot author draft with no locations'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000005","email":"site-scope-org-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'org-wide manager switches organisation'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'site_a_standard')
  ),
  false,
  'org-scope hierarchy.read member cannot author site standard'
);

select throws_ok(
  format(
    'select public.add_five_s_section(%L::uuid, %L, 1)',
    (select id from site_scope_ids where key = 'site_a_version'),
    'Blocked'
  ),
  '42501',
  '5S section creation is not authorised',
  'org-scope hierarchy.read member cannot add five_s section'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000003","email":"site-scope-auditor@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'auditor switches organisation'
);

select is(
  (select count(*)::integer from public.five_s_standards where display_name = 'Cross-site standard'),
  1,
  'multi-site auditor can read cross-site standard'
);

select ok(
  not exists (
    select 1
    from public.membership_job_function_assignments assignment_row
    where assignment_row.membership_id = (
      select id from site_scope_ids where key = 'auditor_membership'
    )
  ),
  'org-wide reader has no home site placement'
);

select is(
  (
    select count(*)::integer
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from site_scope_ids where key = 'cross_site_version')
  ),
  1,
  'auditor can read version scoring row for cross-site standard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000004","email":"site-scope-site-b-lead@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'site B lead switches organisation'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'site_b_standard')
  ),
  true,
  'site B grant with home on site A can author site B standard'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'site_a_standard')
  ),
  false,
  'site B grant with home on site A cannot author site A standard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner selects organisation for template bypass guard'
);

select throws_ok(
  format(
    'select public.add_template_question(%L::uuid, %L::uuid, %L, %L, 1)',
    (select id from site_scope_ids where key = 'cross_site_template_version'),
    (select section_row.id
     from public.template_sections section_row
     where section_row.template_version_id = (
       select id from site_scope_ids where key = 'cross_site_template_version'
     )
     order by section_row.position, section_row.id
     limit 1),
    'short_text',
    'Bypass'
  ),
  '42501',
  '5S audit template questions must use five_s operations',
  'add_template_question rejects five_s audit templates'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.member_can_author_five_s_standard(uuid)',
    'execute'
  ),
  'anon cannot execute member_can_author_five_s_standard'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.membership_can_author_five_s_standard(uuid, uuid, uuid)',
    'execute'
  ),
  'anon cannot execute private membership_can_author_five_s_standard'
);

select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'private.membership_can_author_gemba_definition(uuid, uuid, uuid)',
    'execute'
  ),
  'public cannot execute private.membership_can_author_gemba_definition'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.member_can_author_gemba_definition(uuid)',
    'execute'
  ),
  'anon cannot execute member_can_author_gemba_definition'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.add_five_s_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric)',
    'execute'
  ),
  'anon cannot execute add_five_s_question'
);

select * from finish();
rollback;
