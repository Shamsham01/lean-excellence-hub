begin;

select plan(27);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a7100000-0000-0000-0000-000000000001',
  'module-setup-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a7100000-0000-0000-0000-000000000002',
  'module-setup-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a7100000-0000-0000-0000-000000000003',
  'module-setup-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table module_setup_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on module_setup_ids to authenticated;

insert into module_setup_ids (key, id)
values
(
  'organisation',
  private.provision_organisation(
    'a7100000-0000-0000-0000-000000000001',
    'module-setup-a',
    'Module Setup A'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'a7100000-0000-0000-0000-000000000003',
    'module-setup-b',
    'Module Setup B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a7110000-0000-0000-0000-000000000001',
  'a7100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a7110000-0000-0000-0000-000000000002',
  'a7100000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a7110000-0000-0000-0000-000000000003',
  'a7100000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

reset role;

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from module_setup_ids where key = 'organisation'),
  'a7100000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a7100000-0000-0000-0000-000000000002';

insert into module_setup_ids (key, id)
select 'reader_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'a7100000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a7110000-0000-0000-0000-000000000001","email":"module-setup-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from module_setup_ids where key = 'organisation')),
  'owner selects the module setup organisation'
);

insert into module_setup_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from module_setup_ids where key = 'organisation'),
  null,
  'module-setup-site',
  'Module Setup Site',
  'site'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a7100000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a7110000-0000-0000-0000-000000000003","email":"module-setup-other@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from module_setup_ids where key = 'other_organisation')),
  'sibling owner selects the other organisation'
);

insert into module_setup_ids (key, id)
select 'other_site', public.create_organisation_unit(
  (select id from module_setup_ids where key = 'other_organisation'),
  null,
  'other-site',
  'Other Site',
  'site'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a7110000-0000-0000-0000-000000000001","email":"module-setup-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from module_setup_ids where key = 'organisation')),
  'owner returns to the module setup organisation'
);

insert into module_setup_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from module_setup_ids where key = 'organisation'),
  'module-setup-reader',
  'Module Setup Reader',
  'Read operational modules only'
);

select ok(
  public.add_role_permission(
    (select id from module_setup_ids where key = 'organisation'),
    (select id from module_setup_ids where key = 'reader_role'),
    'five_s.read'
  )
  and public.add_role_permission(
    (select id from module_setup_ids where key = 'organisation'),
    (select id from module_setup_ids where key = 'reader_role'),
    'gemba.read'
  ),
  'reader role receives read permissions only'
);

select ok(
  public.publish_role_version(
    (select id from module_setup_ids where key = 'organisation'),
    (select id from module_setup_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

select ok(
  public.grant_role_version(
    (select id from module_setup_ids where key = 'organisation'),
    (select id from module_setup_ids where key = 'reader_membership'),
    (select id from module_setup_ids where key = 'reader_role'),
    'organisation',
    null
  ) is not null,
  'reader grant is organisation scoped'
);

select is(
  (
    select p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_five_s_standard_draft_from_definition'
  ),
  false,
  'public 5S draft-from-definition is security invoker'
);

select is(
  (
    select p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'create_five_s_standard_draft_from_definition'
  ),
  true,
  'private 5S draft-from-definition is security definer'
);

select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_gemba_definition_draft_from_definition'
  ),
  array['search_path=""']::text[],
  'public Gemba writer keeps an empty search_path'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_five_s_standard_draft_from_definition(text, jsonb, uuid[])',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.create_gemba_definition_draft_from_definition(text, jsonb, uuid[])',
    'EXECUTE'
  ),
  'anon cannot execute module setup draft writers'
);

insert into module_setup_ids (key, id)
select 'five_s_standard', public.create_five_s_standard_draft_from_definition(
  'leh-workplace-5s-standard',
  jsonb_build_object(
    'key', 'leh-workplace-5s-standard',
    'name', 'LEH Workplace 5S Standard',
    'description', 'A starting point for the packing area.',
    'thresholdPercent', 80,
    'categories', jsonb_build_array(
      jsonb_build_object(
        'name', 'Sort',
        'questions', jsonb_build_array(
          jsonb_build_object(
            'prompt', 'Are unused items removed?',
            'questionType', 'yes_no',
            'helpText', 'Look at the area in use.'
          ),
          jsonb_build_object(
            'prompt', 'What remains that is not needed?',
            'questionType', 'short_text',
            'helpText', null
          )
        )
      )
    )
  ),
  array[(select id from module_setup_ids where key = 'site')]::uuid[]
);

select is(
  (
    select version_row.status
    from public.five_s_standard_versions version_row
    where version_row.standard_id = (select id from module_setup_ids where key = 'five_s_standard')
  ),
  'draft',
  '5S quick start remains a draft'
);

select is(
  (
    select count(*)::integer
    from public.five_s_standard_versions version_row
    where version_row.standard_id = (select id from module_setup_ids where key = 'five_s_standard')
      and version_row.status = 'published'
  ),
  0,
  '5S quick start does not publish'
);

select is(
  (
    select count(*)::integer
    from public.template_sections section_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = section_row.template_version_id
    where version_row.standard_id = (select id from module_setup_ids where key = 'five_s_standard')
  ),
  1,
  '5S draft contains the category'
);

select is(
  (
    select scoring_row.scoring_metadata
    from public.five_s_question_scoring scoring_row
    join public.template_questions question_row
      on question_row.id = scoring_row.question_id
    where question_row.prompt = 'Are unused items removed?'
  ),
  '{"type":"yes_no","yes_value":100,"no_value":0}'::jsonb,
  'yes/no questions receive scoring metadata'
);

select is(
  (
    select scoring_row.contributes_to_score
    from public.five_s_question_scoring scoring_row
    join public.template_questions question_row
      on question_row.id = scoring_row.question_id
    where question_row.prompt = 'What remains that is not needed?'
  ),
  false,
  'text questions do not contribute to the score'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        '{"key":"leh-workplace-5s-standard","name":"Broken","description":"Broken","thresholdPercent":80,"categories":[]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from module_setup_ids where key = 'site')
  ),
  '22023',
  'module setup definition has an invalid categories count',
  'malformed 5S definition is rejected'
);

select is(
  (select count(*)::integer from public.five_s_standards),
  1,
  'rejected 5S definition leaves no extra standard'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        '{"key":"leh-workplace-5s-standard","name":"Foreign","description":"Foreign site","thresholdPercent":80,"categories":[{"name":"Sort","questions":[{"prompt":"Is it sorted?","questionType":"yes_no","helpText":null}]}]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from module_setup_ids where key = 'other_site')
  ),
  '23503',
  '5S standard applicability includes an invalid organisational unit',
  'a unit from another organisation is rejected'
);

select is(
  (select count(*)::integer from public.five_s_standards),
  1,
  'cross-organisation applicability rolls back'
);

insert into module_setup_ids (key, id)
select 'gemba_definition', public.create_gemba_definition_draft_from_definition(
  'leh-operational-gemba-walk',
  jsonb_build_object(
    'key', 'leh-operational-gemba-walk',
    'name', 'LEH Operational Gemba Walk',
    'description', 'A short operational walk.',
    'expectedDurationMinutes', 45,
    'sections', jsonb_build_array(
      jsonb_build_object(
        'name', 'Safety',
        'prompts', jsonb_build_array(
          jsonb_build_object(
            'prompt', 'What abnormal condition is visible here?',
            'helpText', null
          )
        )
      )
    )
  ),
  array[(select id from module_setup_ids where key = 'site')]::uuid[]
);

select is(
  (
    select version_row.status
    from public.gemba_definition_versions version_row
    where version_row.definition_id = (select id from module_setup_ids where key = 'gemba_definition')
  ),
  'draft',
  'Gemba quick start remains a draft'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    join public.gemba_definition_versions version_row
      on version_row.template_version_id = question_row.template_version_id
    where version_row.definition_id = (select id from module_setup_ids where key = 'gemba_definition')
      and question_row.question_type = 'short_text'
  ),
  1,
  'Gemba prompt is stored as an observation question'
);

select throws_ok(
  format(
    $sql$
      select public.create_gemba_definition_draft_from_definition(
        'leh-operational-gemba-walk',
        '{"key":"leh-operational-gemba-walk","name":"Broken","description":"Broken","sections":[{"name":"Safety","prompts":[]}]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from module_setup_ids where key = 'site')
  ),
  '22023',
  'module setup definition has an invalid prompts count',
  'malformed Gemba definition is rejected'
);

select is(
  (select count(*)::integer from public.gemba_definitions),
  1,
  'rejected Gemba definition leaves no extra definition'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a7100000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a7110000-0000-0000-0000-000000000002","email":"module-setup-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from module_setup_ids where key = 'organisation')),
  'reader selects the organisation'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        '{"key":"leh-workplace-5s-standard","name":"Reader","description":"Reader","thresholdPercent":80,"categories":[{"name":"Sort","questions":[{"prompt":"Is it sorted?","questionType":"yes_no","helpText":null}]}]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from module_setup_ids where key = 'site')
  ),
  '42501',
  '5S standard creation is not authorised',
  'missing 5S manage permission is denied'
);

select throws_ok(
  format(
    $sql$
      select public.create_gemba_definition_draft_from_definition(
        'leh-operational-gemba-walk',
        '{"key":"leh-operational-gemba-walk","name":"Reader","description":"Reader","sections":[{"name":"Safety","prompts":[{"prompt":"What is visible?","helpText":null}]}]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from module_setup_ids where key = 'site')
  ),
  '42501',
  'gemba definition creation is not authorised',
  'missing Gemba manage permission is denied'
);

select is(
  (select count(*)::integer from public.five_s_standards),
  1,
  'denied 5S creation does not add a standard'
);

select * from finish();

rollback;
