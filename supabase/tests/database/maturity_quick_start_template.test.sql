begin;

select plan(24);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '20900000-0000-4000-8000-000000000001',
    'maturity-quick-start-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '20900000-0000-4000-8000-000000000002',
    'maturity-quick-start-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '20900000-0000-4000-8000-000000000003',
    'maturity-quick-start-sibling@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table maturity_qs_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on maturity_qs_ids to authenticated;

create function pg_temp.quick_start_definition(
  target_prompt text default 'Observable scored question'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'key', 'leh-operational-excellence-standard',
    'name', 'LEH Operational Excellence Standard',
    'description',
      'A practical Operational Excellence maturity framework covering Operations, Health & Safety, Quality & Technical, Engineering & Asset Reliability, and People & Leadership. Use it as a starting point and tailor it to your organisation.',
    'assessmentScopes', jsonb_build_array('site'),
    'levels', (
      select jsonb_agg(
        jsonb_build_object(
          'name', level_row.name,
          'colorToken', 'maturity-' || level_row.n::text,
          'description', 'Level description ' || level_row.n::text,
          'guidance', 'Level guidance ' || level_row.n::text
        )
        order by level_row.n
      )
      from (
        values
          (1, 'Initial'),
          (2, 'Developing'),
          (3, 'Defined'),
          (4, 'Embedded'),
          (5, 'Excellence')
      ) as level_row(n, name)
    ),
    'pillars', (
      select jsonb_agg(pillar_row.pillar_json order by pillar_row.pillar_n)
      from (
        select
          pillar_n,
          jsonb_build_object(
            'name', pillar_name,
            'description', 'Pillar description',
            'guidance', 'Pillar guidance',
            'criteria', (
              select jsonb_agg(criterion_json order by criterion_n)
              from (
                select
                  criterion_n,
                  jsonb_build_object(
                    'name', 'Criterion ' || pillar_n || '.' || criterion_n,
                    'description', 'Criterion description',
                    'guidance', 'Criterion guidance',
                    'questions', jsonb_build_array(
                      jsonb_build_object(
                        'prompt',
                        target_prompt || ' ' || pillar_n || '.' || criterion_n || '.1',
                        'allowsNotApplicable', true
                      ),
                      jsonb_build_object(
                        'prompt',
                        target_prompt || ' ' || pillar_n || '.' || criterion_n || '.2',
                        'allowsNotApplicable', true
                      )
                    )
                  ) as criterion_json
                from generate_series(1, 6) as criterion_n
              ) criteria
            )
          ) as pillar_json
        from (
          values
            (1, 'Operations'),
            (2, 'Health & Safety'),
            (3, 'Quality & Technical'),
            (4, 'Engineering & Asset Reliability'),
            (5, 'People & Leadership')
        ) as named_pillars(pillar_n, pillar_name)
      ) as pillar_row
    )
  )
$$;

grant execute on function pg_temp.quick_start_definition(text) to authenticated;

insert into maturity_qs_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '20900000-0000-4000-8000-000000000001',
      'maturity-quick-start-a',
      'Maturity Quick Start Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '20900000-0000-4000-8000-000000000003',
      'maturity-quick-start-b',
      'Maturity Quick Start Org B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '20900000-0000-4000-8000-000000000011',
    '20900000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '20900000-0000-4000-8000-000000000012',
    '20900000-0000-4000-8000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '20900000-0000-4000-8000-000000000013',
    '20900000-0000-4000-8000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"20900000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20900000-0000-4000-8000-000000000011","email":"maturity-quick-start-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_qs_ids where key = 'org_a')),
  'owner selects organisation A'
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
    (select id from maturity_qs_ids where key = 'org_a'),
    '20900000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into maturity_qs_ids (key, id)
select 'unauthorised_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '20900000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"20900000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20900000-0000-4000-8000-000000000011","email":"maturity-quick-start-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.grant_role_version(
    (select id from maturity_qs_ids where key = 'org_a'),
    (select id from maturity_qs_ids where key = 'unauthorised_membership'),
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
        and role_row.canonical_name = 'finance-validator'
        and role_version.status = 'published'
    ),
    'organisation',
    null
  ) is not null,
  'owner grants finance-validator role without models.manage'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20900000-0000-4000-8000-000000000002","role":"authenticated","session_id":"20900000-0000-4000-8000-000000000012","email":"maturity-quick-start-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_qs_ids where key = 'org_a')),
  'unauthorised member selects organisation A'
);

select throws_ok(
  format(
    'select public.instantiate_maturity_quick_start_template(%L, %L::jsonb)',
    'leh-operational-excellence-standard',
    pg_temp.quick_start_definition()::text
  ),
  '42501',
  'maturity model creation is not authorised',
  'unauthorised member cannot instantiate a Quick Start template'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20900000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20900000-0000-4000-8000-000000000011","email":"maturity-quick-start-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_qs_ids where key = 'org_a')),
  'owner re-selects organisation A'
);

select throws_ok(
  format(
    'select public.instantiate_maturity_quick_start_template(%L, %L::jsonb)',
    'leh-operational-excellence-standard',
    jsonb_set(
      pg_temp.quick_start_definition(),
      '{pillars,0,criteria,0,questions,0,prompt}',
      to_jsonb(''::text)
    )::text
  ),
  '22023',
  'maturity Quick Start template has an empty question prompt',
  'empty question prompts are rejected before a tenant copy is created'
);

select is(
  (
    select count(*)
    from public.maturity_models
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
  ),
  0::bigint,
  'rejected empty-prompt payload leaves no tenant framework'
);

select throws_ok(
  format(
    'select public.instantiate_maturity_quick_start_template(%L, %L::jsonb)',
    'leh-operational-excellence-standard',
    jsonb_set(
      pg_temp.quick_start_definition(repeat('x', 501)),
      '{pillars,0,criteria,0,questions,0,prompt}',
      to_jsonb(repeat('x', 501))
    )::text
  ),
  '23514',
  null,
  'over-long prompt fails during insert and rolls back the transaction'
);

select is(
  (
    select count(*)
    from public.maturity_models
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
  ),
  0::bigint,
  'partial instantiation does not leave a visible draft framework'
);

insert into maturity_qs_ids (key, id)
select 'model_a', public.instantiate_maturity_quick_start_template(
  'leh-operational-excellence-standard',
  pg_temp.quick_start_definition()
);

insert into maturity_qs_ids (key, id)
select 'model_version_a', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
  and model_version.model_id = (select id from maturity_qs_ids where key = 'model_a')
  and model_version.version_number = 1;

select is(
  (
    select organisation_id
    from public.maturity_models
    where id = (select id from maturity_qs_ids where key = 'model_a')
  ),
  (select id from maturity_qs_ids where key = 'org_a'),
  'created model belongs to the current organisation'
);

select is(
  (
    select status
    from public.maturity_model_versions
    where id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  'draft',
  'created version is draft'
);

select is(
  (
    select count(*)
    from public.maturity_model_versions
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and model_id = (select id from maturity_qs_ids where key = 'model_a')
      and status = 'published'
  ),
  0::bigint,
  'instantiation does not publish a version'
);

select is(
  (
    select array_agg(scope_type order by scope_type)
    from public.maturity_model_version_assessment_scopes
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  array['site']::text[],
  'assessment scope is site'
);

select is(
  (
    select count(*)
    from public.maturity_levels
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  5::bigint,
  'five levels are created'
);

select is(
  (
    select count(*)
    from public.maturity_pillars
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  5::bigint,
  'five pillars are created'
);

select is(
  (
    select count(*)
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row
      on pillar_row.id = criterion_row.pillar_id
    where pillar_row.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and pillar_row.model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  30::bigint,
  'thirty criteria are created'
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = question_row.section_id
    where pillar_row.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and pillar_row.model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  60::bigint,
  'sixty questions are created'
);

select is(
  (
    select count(*)
    from public.maturity_criterion_questions link_row
    join public.maturity_criteria criterion_row
      on criterion_row.id = link_row.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.id = criterion_row.pillar_id
    where pillar_row.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and pillar_row.model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
      and link_row.contributes_to_score = true
      and link_row.scoring_metadata = '{"type":"direct"}'::jsonb
  ),
  60::bigint,
  'all questions are linked as direct scored questions'
);

select ok(
  not exists (
    select 1
    from public.template_questions question_row
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = question_row.section_id
    where pillar_row.organisation_id = (select id from maturity_qs_ids where key = 'org_a')
      and pillar_row.model_version_id = (select id from maturity_qs_ids where key = 'model_version_a')
      and (
        question_row.question_type <> 'score'
        or question_row.allows_not_applicable is not true
        or question_row.is_required is not true
      )
  ),
  'question scoring metadata remains compatible with the assessment engine'
);

select ok(
  public.publish_maturity_model_version(
    (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  'generated framework passes publish-readiness checks'
);

insert into maturity_qs_ids (key, id)
select 'model_a_second', public.instantiate_maturity_quick_start_template(
  'leh-operational-excellence-standard',
  pg_temp.quick_start_definition('Second draft question')
);

select is(
  (
    select count(*)
    from public.maturity_models
    where organisation_id = (select id from maturity_qs_ids where key = 'org_a')
  ),
  2::bigint,
  'an organisation may use the built-in template more than once'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20900000-0000-4000-8000-000000000003","role":"authenticated","session_id":"20900000-0000-4000-8000-000000000013","email":"maturity-quick-start-sibling@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_qs_ids where key = 'org_b')),
  'sibling tenant selects organisation B'
);

select is(
  (
    select count(*)
    from public.maturity_models
    where id = (select id from maturity_qs_ids where key = 'model_a')
  ),
  0::bigint,
  'sibling tenant cannot inspect the other organisation framework'
);

select throws_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 6, ''Extra'', ''maturity-6'')',
    (select id from maturity_qs_ids where key = 'model_version_a')
  ),
  '55000',
  null,
  'sibling tenant cannot mutate the other organisation framework'
);

select * from finish();
rollback;
