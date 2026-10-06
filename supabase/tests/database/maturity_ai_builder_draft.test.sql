begin;

select plan(45);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b2080000-0000-4000-8000-000000000001',
    'maturity-builder-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b2080000-0000-4000-8000-000000000002',
    'maturity-builder-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b2080000-0000-4000-8000-000000000003',
    'maturity-builder-sibling@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table maturity_builder_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on maturity_builder_ids to authenticated;

-- Mirrors maturityBuilderProposalToDefinition: non-uniform hierarchy,
-- server-derived colour tokens and empty optional guidance.
create function pg_temp.builder_definition()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'key', 'leanai-maturity-builder',
    'name', 'Builder Org Operational Excellence Framework',
    'description', 'How our sites and areas build safe, quality-led daily work.',
    'assessmentScopes', jsonb_build_array('site', 'area'),
    'levels', jsonb_build_array(
      jsonb_build_object('name', 'Reactive', 'colorToken', 'maturity-1',
        'description', 'Problems are handled as they appear.', 'guidance', ''),
      jsonb_build_object('name', 'Developing', 'colorToken', 'maturity-2',
        'description', 'Standards exist in places.', 'guidance', 'Look for local standards.'),
      jsonb_build_object('name', 'Practising', 'colorToken', 'maturity-3',
        'description', 'Standards are used daily.', 'guidance', 'Look for daily use.'),
      jsonb_build_object('name', 'Sustaining', 'colorToken', 'maturity-4',
        'description', 'Standards improve without prompting.', 'guidance', 'Look for ownership.')
    ),
    'pillars', jsonb_build_array(
      jsonb_build_object(
        'name', 'Safe Work',
        'description', 'Work is planned and done safely.',
        'guidance', 'Observe the work, not the paperwork.',
        'criteria', jsonb_build_array(
          jsonb_build_object(
            'name', 'Hazards are visible',
            'description', 'Hazards are identified at the point of work.',
            'guidance', '',
            'questions', jsonb_build_array(
              jsonb_build_object('prompt', 'Can operators point to the hazards in their area?', 'allowsNotApplicable', true),
              jsonb_build_object('prompt', 'Are controls visible where the work happens?', 'allowsNotApplicable', true)
            )
          ),
          jsonb_build_object(
            'name', 'Near misses drive action',
            'description', 'Near misses are reported and acted on.',
            'guidance', 'Check recent actions.',
            'questions', jsonb_build_array(
              jsonb_build_object('prompt', 'Were recent near misses closed with an action?', 'allowsNotApplicable', true)
            )
          )
        )
      ),
      jsonb_build_object(
        'name', 'Quality at Source',
        'description', 'Defects are prevented where work is done.',
        'guidance', 'Follow one product through the area.',
        'criteria', jsonb_build_array(
          jsonb_build_object(
            'name', 'Standard work is followed',
            'description', 'Critical steps follow a visible standard.',
            'guidance', 'Compare work to the standard.',
            'questions', jsonb_build_array(
              jsonb_build_object('prompt', 'Does the observed work match the posted standard?', 'allowsNotApplicable', true)
            )
          )
        )
      ),
      jsonb_build_object(
        'name', 'Continuous Improvement',
        'description', 'Teams improve their own work.',
        'guidance', 'Ask the team, not the manager.',
        'criteria', jsonb_build_array(
          jsonb_build_object(
            'name', 'Ideas are captured',
            'description', 'Improvement ideas are captured and visible.',
            'guidance', 'Look at the board.',
            'questions', jsonb_build_array(
              jsonb_build_object('prompt', 'Can the team show ideas raised this month?', 'allowsNotApplicable', true)
            )
          ),
          jsonb_build_object(
            'name', 'Improvements are sustained',
            'description', 'Completed improvements stay in place.',
            'guidance', 'Revisit a recent change.',
            'questions', jsonb_build_array(
              jsonb_build_object('prompt', 'Is a change from last quarter still in place?', 'allowsNotApplicable', true),
              jsonb_build_object('prompt', 'Was the standard updated after the change?', 'allowsNotApplicable', true)
            )
          )
        )
      )
    )
  )
$$;

grant execute on function pg_temp.builder_definition() to authenticated;

insert into maturity_builder_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'b2080000-0000-4000-8000-000000000001',
      'maturity-builder-a',
      'Maturity Builder Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'b2080000-0000-4000-8000-000000000003',
      'maturity-builder-b',
      'Maturity Builder Org B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'b2081000-0000-4000-8000-000000000001',
    'b2080000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b2081000-0000-4000-8000-000000000002',
    'b2080000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'b2081000-0000-4000-8000-000000000003',
    'b2080000-0000-4000-8000-000000000003',
    statement_timestamp(), statement_timestamp()
  );

-- ---------------------------------------------------------------------------
-- Conversation phase: AI enablement, builder session, usage, no framework rows
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"b2080000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2081000-0000-4000-8000-000000000001","email":"maturity-builder-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_builder_ids where key = 'org_a')),
  'owner selects organisation A'
);

select throws_ok(
  $$select public.create_ai_coach_session('maturity', 'maturity_framework_builder', null, 'LeanAI Maturity Framework builder', 'maturity-builder-context-v1')$$,
  '42501',
  'ai session creation is not authorised',
  'builder cannot start while organisation AI is disabled'
);

select lives_ok(
  $$select public.update_organisation_ai_settings(true, 100000)$$,
  'owner enables organisation AI'
);

insert into maturity_builder_ids (key, id)
select 'builder_session', public.create_ai_coach_session(
  'maturity',
  'maturity_framework_builder',
  null,
  'LeanAI Maturity Framework builder',
  'maturity-builder-context-v1'
);

select is(
  (
    select row(context_type, module_key, intervention_key, context_contract_version)
    from public.ai_sessions
    where id = (select id from maturity_builder_ids where key = 'builder_session')
  ),
  row(
    'coach'::text,
    'maturity'::text,
    'maturity_framework_builder'::text,
    'maturity-builder-context-v1'::text
  ),
  'builder conversation is an existing Coach session bound to the Maturity builder intervention'
);

select is(
  public.create_ai_coach_session(
    'maturity',
    'maturity_framework_builder',
    null,
    'LeanAI Maturity Framework builder',
    'maturity-builder-context-v1'
  ),
  (select id from maturity_builder_ids where key = 'builder_session'),
  'refinement turns reuse the same authorised builder session'
);

insert into maturity_builder_ids (key, id)
select 'proposal_run', public.start_ai_run(
  (select id from maturity_builder_ids where key = 'builder_session'),
  E'[Maturity framework builder · context 0123456789ab]\n\nUser request:\nDraft a proposal now.',
  'maturity-builder-run-1',
  'fake',
  'gpt-4.1-mini',
  'leanai-maturity-framework-builder',
  'v1',
  'hash-builder-1'
);

insert into maturity_builder_ids (key, id)
select 'proposal_message', public.finish_ai_run(
  (select id from maturity_builder_ids where key = 'proposal_run'),
  'Here is a first proposal for your review.',
  jsonb_build_object(
    'kind', 'maturity_framework_builder_turn',
    'version', 1,
    'response_status', 'ok',
    'intent', 'propose',
    'proposal_status', 'valid',
    'proposal', pg_temp.builder_definition()
  ),
  'maturity-builder-context-v1',
  jsonb_build_object(
    'context_type', 'coach',
    'logical_model_class', 'standard',
    'intervention_key', 'maturity_framework_builder'
  ),
  'manifest-builder-1',
  null,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  220,
  480,
  0,
  0,
  0,
  1200
);

select ok(
  (select id from maturity_builder_ids where key = 'proposal_message') is not null,
  'finish_ai_run stores the proposal turn as an assistant message'
);

select is(
  (
    select row(count(*)::integer, sum(input_tokens)::integer, sum(output_tokens)::integer)
    from public.ai_usage_events
    where organisation_id = (select id from maturity_builder_ids where key = 'org_a')
      and ai_session_id = (select id from maturity_builder_ids where key = 'builder_session')
  ),
  row(1, 220, 480),
  'proposal turn usage is recorded on the existing ledger'
);

select is(
  (
    select structured_payload ->> 'kind'
    from public.ai_messages
    where id = (select id from maturity_builder_ids where key = 'proposal_message')
  ),
  'maturity_framework_builder_turn',
  'creator can read the stored proposal payload'
);

insert into maturity_builder_ids (key, id)
select 'failed_run', public.start_ai_run(
  (select id from maturity_builder_ids where key = 'builder_session'),
  E'[Maturity framework builder · context 0123456789ab]\n\nUser request:\nRefine pillar Safe Work.',
  'maturity-builder-run-2',
  'fake',
  'gpt-4.1-mini',
  'leanai-maturity-framework-builder',
  'v1',
  'hash-builder-1'
);

select lives_ok(
  format(
    'select public.fail_ai_run(%L::uuid, %L, %L)',
    (select id from maturity_builder_ids where key = 'failed_run'),
    'provider_error',
    'Fake provider failure'
  ),
  'a failed provider turn can be closed for retry'
);

select is(
  (
    select count(*)::integer
    from public.ai_usage_events
    where ai_session_id = (select id from maturity_builder_ids where key = 'builder_session')
  ),
  1,
  'failed provider turns record no additional usage'
);

select is(
  (
    select count(*)
    from public.maturity_models
    where organisation_id = (select id from maturity_builder_ids where key = 'org_a')
  ),
  0::bigint,
  'a stored LeanAI proposal creates no Maturity framework'
);

select is(
  (
    select count(*)
    from public.maturity_model_versions
    where organisation_id = (select id from maturity_builder_ids where key = 'org_a')
  ),
  0::bigint,
  'a stored LeanAI proposal creates no framework version'
);

-- ---------------------------------------------------------------------------
-- Acceptance: existing bulk draft RPC, exact hierarchy, draft only
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    'select public.create_maturity_model_draft_from_definition(%L, %L::jsonb)',
    'leh-operational-excellence-standard',
    pg_temp.builder_definition()::text
  ),
  '22023',
  'declared template key does not match the definition',
  'builder definitions cannot be filed under another template key'
);

insert into maturity_builder_ids (key, id)
select 'model', public.create_maturity_model_draft_from_definition(
  'leanai-maturity-builder',
  pg_temp.builder_definition()
);

insert into maturity_builder_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from maturity_builder_ids where key = 'org_a')
  and model_version.model_id = (select id from maturity_builder_ids where key = 'model')
  and model_version.version_number = 1;

select is(
  (
    select row(organisation_id, display_name)
    from public.maturity_models
    where id = (select id from maturity_builder_ids where key = 'model')
  ),
  row(
    (select id from maturity_builder_ids where key = 'org_a'),
    'Builder Org Operational Excellence Framework'::text
  ),
  'accepted proposal creates an organisation-owned framework'
);

select is(
  (
    select status
    from public.maturity_model_versions
    where id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  'draft',
  'accepted proposal creates a draft version'
);

select is(
  (
    select count(*)
    from public.maturity_model_versions
    where model_id = (select id from maturity_builder_ids where key = 'model')
      and status = 'published'
  ),
  0::bigint,
  'accepted proposal is never published automatically'
);

select is(
  (
    select array_agg(scope_type order by scope_type)
    from public.maturity_model_version_assessment_scopes
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array['area', 'site']::text[],
  'assessment scopes persist'
);

select is(
  (
    select array_agg(name order by level_number)
    from public.maturity_levels
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array['Reactive', 'Developing', 'Practising', 'Sustaining']::text[],
  'levels persist in proposal order'
);

select is(
  (
    select array_agg(color_token order by level_number)
    from public.maturity_levels
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array['maturity-1', 'maturity-2', 'maturity-3', 'maturity-4']::text[],
  'level colour tokens are the server-derived scale'
);

select is(
  (
    select array_agg(level_number order by level_number)
    from public.maturity_levels
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
      and guidance is null
  ),
  array[1]::integer[],
  'empty optional level guidance is stored as null'
);

select is(
  (
    select array_agg(name order by position)
    from public.maturity_pillars
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array['Safe Work', 'Quality at Source', 'Continuous Improvement']::text[],
  'pillars persist in proposal order'
);

select is(
  (
    select array_agg(criterion_row.name order by pillar_row.position, criterion_row.position)
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row on pillar_row.id = criterion_row.pillar_id
    where pillar_row.model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array[
    'Hazards are visible',
    'Near misses drive action',
    'Standard work is followed',
    'Ideas are captured',
    'Improvements are sustained'
  ]::text[],
  'criteria persist under the right pillars in order'
);

select is(
  (
    select array_agg(pillar_row.name order by pillar_row.position, criterion_row.position)
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row on pillar_row.id = criterion_row.pillar_id
    where pillar_row.model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array[
    'Safe Work',
    'Safe Work',
    'Quality at Source',
    'Continuous Improvement',
    'Continuous Improvement'
  ]::text[],
  'non-uniform criteria counts per pillar are preserved'
);

select is(
  (
    select array_agg(criterion_row.name order by criterion_row.name)
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row on pillar_row.id = criterion_row.pillar_id
    where pillar_row.model_version_id = (select id from maturity_builder_ids where key = 'model_version')
      and criterion_row.guidance is null
  ),
  array['Hazards are visible']::text[],
  'empty optional criterion guidance is stored as null'
);

select is(
  (
    select array_agg(
      criterion_row.name || ' :: ' || question_row.prompt
      order by pillar_row.position, criterion_row.position, question_row.position
    )
    from public.maturity_criterion_questions link_row
    join public.maturity_criteria criterion_row on criterion_row.id = link_row.criterion_id
    join public.maturity_pillars pillar_row on pillar_row.id = criterion_row.pillar_id
    join public.template_questions question_row on question_row.id = link_row.question_id
    where pillar_row.model_version_id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  array[
    'Hazards are visible :: Can operators point to the hazards in their area?',
    'Hazards are visible :: Are controls visible where the work happens?',
    'Near misses drive action :: Were recent near misses closed with an action?',
    'Standard work is followed :: Does the observed work match the posted standard?',
    'Ideas are captured :: Can the team show ideas raised this month?',
    'Improvements are sustained :: Is a change from last quarter still in place?',
    'Improvements are sustained :: Was the standard updated after the change?'
  ]::text[],
  'every scored question is linked to its proposed criterion in order'
);

select ok(
  not exists (
    select 1
    from public.maturity_criterion_questions link_row
    join public.maturity_criteria criterion_row on criterion_row.id = link_row.criterion_id
    join public.maturity_pillars pillar_row on pillar_row.id = criterion_row.pillar_id
    join public.template_questions question_row on question_row.id = link_row.question_id
    where pillar_row.model_version_id = (select id from maturity_builder_ids where key = 'model_version')
      and (
        link_row.contributes_to_score is not true
        or link_row.scoring_metadata <> '{"type":"direct"}'::jsonb
        or question_row.question_type <> 'score'
        or question_row.allows_not_applicable is not true
      )
  ),
  'questions are direct scored questions compatible with the assessment engine'
);

-- ---------------------------------------------------------------------------
-- Editable afterwards through normal authoring RPCs, still unpublished
-- ---------------------------------------------------------------------------

select ok(
  public.update_maturity_level(
    (
      select id
      from public.maturity_levels
      where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
        and level_number = 1
    ),
    1,
    'Reacting',
    'maturity-1',
    'Problems are handled as they appear.',
    'Look for firefighting.'
  ),
  'accepted draft levels are editable through the normal authoring path'
);

select is(
  (
    select row(name, guidance)
    from public.maturity_levels
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
      and level_number = 1
  ),
  row('Reacting'::text, 'Look for firefighting.'::text),
  'manual edits persist on the accepted draft'
);

select is(
  (
    select status
    from public.maturity_model_versions
    where id = (select id from maturity_builder_ids where key = 'model_version')
  ),
  'draft',
  'editing the accepted draft does not publish it'
);

reset role;

select is(
  (
    select audit_row.metadata ->> 'declared_template_key'
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from maturity_builder_ids where key = 'org_a')
      and audit_row.resource_record_id = (select id from maturity_builder_ids where key = 'model')
      and audit_row.event_action = 'maturity.model.draft_created_from_definition'
  ),
  'leanai-maturity-builder',
  'audit records LeanAI builder provenance as the declared key'
);

select is(
  (
    select count(*)
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from maturity_builder_ids where key = 'org_a')
      and audit_row.event_action = 'maturity.model.quick_start_instantiated'
  ),
  0::bigint,
  'builder drafts never claim official Quick Start provenance'
);

-- ---------------------------------------------------------------------------
-- Sibling tenant isolation
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"b2080000-0000-4000-8000-000000000003","role":"authenticated","session_id":"b2081000-0000-4000-8000-000000000003","email":"maturity-builder-sibling@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_builder_ids where key = 'org_b')),
  'sibling owner selects organisation B'
);

select throws_ok(
  $$select public.create_ai_coach_session('maturity', 'maturity_framework_builder', null, 'LeanAI Maturity Framework builder', 'maturity-builder-context-v1')$$,
  '42501',
  'ai session creation is not authorised',
  'organisation A AI enablement does not enable the builder for organisation B'
);

select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from maturity_builder_ids where key = 'builder_session')
  ),
  '42501',
  'ai session read is not authorised',
  'sibling tenant cannot read the builder conversation'
);

select is(
  (
    select count(*)
    from public.ai_messages
    where ai_session_id = (select id from maturity_builder_ids where key = 'builder_session')
  ),
  0::bigint,
  'sibling tenant cannot select builder proposal messages'
);

select is(
  (
    select count(*)
    from public.maturity_models
    where id = (select id from maturity_builder_ids where key = 'model')
  ),
  0::bigint,
  'sibling tenant cannot see the accepted draft'
);

select throws_ok(
  format(
    'select public.update_maturity_level(%L::uuid, 1, %L, %L)',
    (
      select id
      from public.maturity_levels
      where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
        and level_number = 1
    ),
    'Hijacked',
    'maturity-1'
  ),
  null,
  null,
  'sibling tenant cannot edit the accepted draft'
);

reset role;

select is(
  (
    select name
    from public.maturity_levels
    where model_version_id = (select id from maturity_builder_ids where key = 'model_version')
      and level_number = 1
  ),
  'Reacting',
  'sibling edit attempt leaves the draft unchanged'
);

-- ---------------------------------------------------------------------------
-- AI access never substitutes for maturity.models.manage
-- ---------------------------------------------------------------------------

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from maturity_builder_ids where key = 'org_a'),
    'b2080000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into maturity_builder_ids (key, id)
select 'member_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b2080000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"b2080000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2081000-0000-4000-8000-000000000001","email":"maturity-builder-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_builder_ids where key = 'org_a')),
  'owner re-selects organisation A'
);

select ok(
  public.grant_role_version(
    (select id from maturity_builder_ids where key = 'org_a'),
    (select id from maturity_builder_ids where key = 'member_membership'),
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from maturity_builder_ids where key = 'org_a')
        and role_row.canonical_name = 'finance-validator'
        and role_version.status = 'published'
    ),
    'organisation',
    null
  ) is not null,
  'owner grants a role without maturity.models.manage'
);

-- Hostile probe: force AI access on so the only remaining gate is RBAC.
reset role;
create or replace function private.can_use_ai(target_organisation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $builder_ai_probe$ select true $builder_ai_probe$;
alter function private.can_use_ai(uuid) owner to lean_hub_private_owner;

select set_config(
  'request.jwt.claims',
  '{"sub":"b2080000-0000-4000-8000-000000000002","role":"authenticated","session_id":"b2081000-0000-4000-8000-000000000002","email":"maturity-builder-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_builder_ids where key = 'org_a')),
  'member without manage selects organisation A'
);

insert into maturity_builder_ids (key, id)
select 'member_session', public.create_ai_coach_session(
  'maturity',
  'maturity_framework_builder',
  null,
  'LeanAI Maturity Framework builder',
  'maturity-builder-context-v1'
);

select isnt(
  (select id from maturity_builder_ids where key = 'member_session'),
  (select id from maturity_builder_ids where key = 'builder_session'),
  'builder sessions are private to each member'
);

select throws_ok(
  format(
    'select public.get_ai_session_detail(%L::uuid)',
    (select id from maturity_builder_ids where key = 'builder_session')
  ),
  '42501',
  'ai session read is not authorised',
  'another member cannot read the owner builder conversation'
);

select throws_ok(
  format(
    'select public.create_maturity_model_draft_from_definition(%L, %L::jsonb)',
    'leanai-maturity-builder',
    pg_temp.builder_definition()::text
  ),
  '42501',
  'maturity model creation is not authorised',
  'AI access without maturity.models.manage cannot create a framework draft'
);

reset role;

select is(
  (
    select count(*)
    from public.maturity_models
    where organisation_id = (select id from maturity_builder_ids where key = 'org_a')
  ),
  1::bigint,
  'only the authorised acceptance created a framework'
);

select * from finish();
rollback;
