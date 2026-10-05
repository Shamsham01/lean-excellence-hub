begin;

select plan(41);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    'order-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    'order-member-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    'order-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table order_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on order_ids to authenticated;

insert into order_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '21000000-0000-4000-8000-000000000001',
      'order-tenant-a',
      'Ordering Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '21000000-0000-4000-8000-000000000003',
      'order-tenant-b',
      'Ordering Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '21000000-0000-4000-8000-000000000011',
    '21000000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '21000000-0000-4000-8000-000000000012',
    '21000000-0000-4000-8000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '21000000-0000-4000-8000-000000000013',
    '21000000-0000-4000-8000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"21000000-0000-4000-8000-000000000013","email":"order-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from order_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

insert into order_ids (key, id)
select 'model_b', public.create_maturity_model_draft('Tenant B Framework');

insert into order_ids (key, id)
select 'version_b', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from order_ids where key = 'org_b')
  and model_version.model_id = (select id from order_ids where key = 'model_b');

insert into order_ids (key, id)
select 'pillar_b', public.add_maturity_pillar(
  (select id from order_ids where key = 'version_b'),
  'Foreign pillar'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"21000000-0000-4000-8000-000000000011","email":"order-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from order_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

insert into order_ids (key, id)
select 'model_a', public.create_maturity_model_draft('Ordering Framework');

insert into order_ids (key, id)
select 'version_a', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from order_ids where key = 'org_a')
  and model_version.model_id = (select id from order_ids where key = 'model_a');

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from order_ids where key = 'version_a')
  ),
  'tenant A adds a level'
);

insert into order_ids (key, id)
select 'pillar_leadership', public.add_maturity_pillar(
  (select id from order_ids where key = 'version_a'),
  'Leadership'
);

select is(
  (
    select pillar_row.position
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from order_ids where key = 'pillar_leadership')
  ),
  1,
  'first pillar appends at position 1'
);

insert into order_ids (key, id)
select 'pillar_daily', public.add_maturity_pillar(
  (select id from order_ids where key = 'version_a'),
  'Daily Management'
);

insert into order_ids (key, id)
select 'pillar_problem', public.add_maturity_pillar(
  (select id from order_ids where key = 'version_a'),
  'Problem Solving'
);

select is(
  array(
    select pillar_row.name
    from public.maturity_pillars pillar_row
    where pillar_row.model_version_id = (select id from order_ids where key = 'version_a')
    order by pillar_row.position, pillar_row.id
  ),
  array['Leadership', 'Daily Management', 'Problem Solving']::text[],
  'subsequent pillars append after existing pillars'
);

insert into order_ids (key, id)
select 'criterion_gemba', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_leadership'),
  'Gemba'
);

insert into order_ids (key, id)
select 'criterion_standards', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_leadership'),
  'Standards'
);

insert into order_ids (key, id)
select 'criterion_huddles', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_daily'),
  'Huddles'
);

select is(
  array(
    select criterion_row.name
    from public.maturity_criteria criterion_row
    where criterion_row.pillar_id = (select id from order_ids where key = 'pillar_leadership')
    order by criterion_row.position, criterion_row.id
  ),
  array['Gemba', 'Standards']::text[],
  'criteria append within the selected pillar'
);

select is(
  (
    select criterion_row.position
    from public.maturity_criteria criterion_row
    where criterion_row.id = (select id from order_ids where key = 'criterion_huddles')
  ),
  1,
  'first criterion in another pillar starts at position 1'
);

insert into order_ids (key, id)
select 'question_gemba_1', public.add_maturity_question(
  (select id from order_ids where key = 'version_a'),
  (
    select pillar_row.section_id
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from order_ids where key = 'pillar_leadership')
  ),
  'score',
  'Rate Gemba cadence'
);

insert into order_ids (key, id)
select 'question_gemba_2', public.add_maturity_question(
  (select id from order_ids where key = 'version_a'),
  (
    select pillar_row.section_id
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from order_ids where key = 'pillar_leadership')
  ),
  'score',
  'Rate Gemba coaching'
);

insert into order_ids (key, id)
select 'question_standards', public.add_maturity_question(
  (select id from order_ids where key = 'version_a'),
  (
    select pillar_row.section_id
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from order_ids where key = 'pillar_leadership')
  ),
  'score',
  'Rate Standards'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_gemba'),
    (select id from order_ids where key = 'question_gemba_1')
  ),
  'link first Gemba question'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_gemba'),
    (select id from order_ids where key = 'question_gemba_2')
  ),
  'link second Gemba question'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_standards'),
    (select id from order_ids where key = 'question_standards')
  ),
  'link Standards question'
);

select is(
  array(
    select question_row.prompt
    from public.template_questions question_row
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = question_row.section_id
    where pillar_row.id = (select id from order_ids where key = 'pillar_leadership')
    order by question_row.position, question_row.id
  ),
  array['Rate Gemba cadence', 'Rate Gemba coaching', 'Rate Standards']::text[],
  'questions append within the pillar section'
);

select ok(
  public.reorder_maturity_pillar(
    (select id from order_ids where key = 'pillar_daily'),
    'up'
  ),
  'move Daily Management pillar up'
);

select is(
  array(
    select pillar_row.name
    from public.maturity_pillars pillar_row
    where pillar_row.model_version_id = (select id from order_ids where key = 'version_a')
    order by pillar_row.position, pillar_row.id
  ),
  array['Daily Management', 'Leadership', 'Problem Solving']::text[],
  'pillar move up swaps with the previous sibling'
);

select ok(
  public.reorder_maturity_pillar(
    (select id from order_ids where key = 'pillar_daily'),
    'down'
  ),
  'move Daily Management pillar down'
);

select is(
  array(
    select pillar_row.name
    from public.maturity_pillars pillar_row
    where pillar_row.model_version_id = (select id from order_ids where key = 'version_a')
    order by pillar_row.position, pillar_row.id
  ),
  array['Leadership', 'Daily Management', 'Problem Solving']::text[],
  'pillar move down restores the original sibling order'
);

select throws_ok(
  format(
    'select public.reorder_maturity_pillar(%L::uuid, ''up'')',
    (select id from order_ids where key = 'pillar_leadership')
  ),
  '22023',
  'maturity pillar cannot move further in that direction',
  'first pillar cannot move up'
);

select throws_ok(
  format(
    'select public.reorder_maturity_pillar(%L::uuid, ''down'')',
    (select id from order_ids where key = 'pillar_problem')
  ),
  '22023',
  'maturity pillar cannot move further in that direction',
  'last pillar cannot move down'
);

select ok(
  public.reorder_maturity_criterion(
    (select id from order_ids where key = 'criterion_standards'),
    'up'
  ),
  'move Standards criterion up'
);

select is(
  array(
    select criterion_row.name
    from public.maturity_criteria criterion_row
    where criterion_row.pillar_id = (select id from order_ids where key = 'pillar_leadership')
    order by criterion_row.position, criterion_row.id
  ),
  array['Standards', 'Gemba']::text[],
  'criterion reorder stays inside the pillar'
);

select ok(
  public.reorder_maturity_question(
    (select id from order_ids where key = 'question_gemba_2'),
    'up'
  ),
  'move second Gemba question up'
);

select is(
  array(
    select question_row.prompt
    from public.template_questions question_row
    join public.maturity_criterion_questions question_link
      on question_link.question_id = question_row.id
    where question_link.criterion_id = (select id from order_ids where key = 'criterion_gemba')
    order by question_row.position, question_row.id
  ),
  array['Rate Gemba coaching', 'Rate Gemba cadence']::text[],
  'question reorder stays inside the criterion'
);

select throws_ok(
  format(
    'select public.reorder_maturity_question(%L::uuid, ''up'')',
    (select id from order_ids where key = 'question_gemba_2')
  ),
  '22023',
  'maturity question cannot move further in that direction',
  'first question in a criterion cannot move up'
);

select ok(
  public.move_maturity_criterion(
    (select id from order_ids where key = 'criterion_standards'),
    (select id from order_ids where key = 'pillar_daily')
  ),
  'move criterion to another pillar'
);

select is(
  (
    select criterion_row.position
    from public.maturity_criteria criterion_row
    where criterion_row.id = (select id from order_ids where key = 'criterion_standards')
  ),
  2,
  'moved criterion appends after existing criteria in the destination pillar'
);

select is(
  (
    select criterion_row.pillar_id
    from public.maturity_criteria criterion_row
    where criterion_row.id = (select id from order_ids where key = 'criterion_standards')
  ),
  (select id from order_ids where key = 'pillar_daily'),
  'moved criterion belongs to the destination pillar'
);

select ok(
  public.move_maturity_question(
    (select id from order_ids where key = 'question_gemba_1'),
    (select id from order_ids where key = 'criterion_standards')
  ),
  'move question to a criterion in another pillar'
);

select is(
  (
    select question_row.position
    from public.template_questions question_row
    where question_row.id = (select id from order_ids where key = 'question_gemba_1')
  ),
  (
    select pg_catalog.max(other_question.position)
    from public.template_questions other_question
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = other_question.section_id
    where pillar_row.id = (select id from order_ids where key = 'pillar_daily')
  ),
  'moved question appends at the end of the destination pillar section'
);

insert into order_ids (key, id)
select 'criterion_middle', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_problem'),
  'First'
);

insert into order_ids (key, id)
select 'criterion_delete', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_problem'),
  'Middle'
);

insert into order_ids (key, id)
select 'criterion_last', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_problem'),
  'Last'
);

select ok(
  public.delete_maturity_criterion((select id from order_ids where key = 'criterion_delete')),
  'delete the middle criterion sibling'
);

select is(
  array(
    select criterion_row.name
    from public.maturity_criteria criterion_row
    where criterion_row.pillar_id = (select id from order_ids where key = 'pillar_problem')
    order by criterion_row.position, criterion_row.id
  ),
  array['First', 'Last']::text[],
  'remaining siblings keep deterministic order after a middle delete'
);

insert into order_ids (key, id)
select 'criterion_appended', public.add_maturity_criterion(
  (select id from order_ids where key = 'pillar_problem'),
  'Appended'
);

select is(
  (
    select criterion_row.position
    from public.maturity_criteria criterion_row
    where criterion_row.id = (select id from order_ids where key = 'criterion_appended')
  ),
  4,
  'new records still append after the highest remaining sibling position'
);

select throws_ok(
  format(
    'select public.reorder_maturity_pillar(%L::uuid, ''up'')',
    (select id from order_ids where key = 'pillar_b')
  ),
  '55000',
  'maturity pillar is not editable',
  'cross-tenant reorder target is rejected'
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
    (select id from order_ids where key = 'org_a'),
    '21000000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into order_ids (key, id)
select 'unauthorised_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '21000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"21000000-0000-4000-8000-000000000011","email":"order-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.grant_role_version(
    (select id from order_ids where key = 'org_a'),
    (select id from order_ids where key = 'unauthorised_membership'),
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from order_ids where key = 'org_a')
        and role_row.canonical_name = 'finance-validator'
        and role_version.status = 'published'
    ),
    'organisation',
    null
  ) is not null,
  'owner grants finance-validator role without models.manage'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_huddles'),
    (
      select public.add_maturity_question(
        (select id from order_ids where key = 'version_a'),
        (
          select pillar_row.section_id
          from public.maturity_pillars pillar_row
          where pillar_row.id = (select id from order_ids where key = 'pillar_daily')
        ),
        'score',
        'Rate huddles'
      )
    )
  ),
  'destination pillar keeps a scored question so the draft can publish'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_last'),
    (
      select public.add_maturity_question(
        (select id from order_ids where key = 'version_a'),
        (
          select pillar_row.section_id
          from public.maturity_pillars pillar_row
          where pillar_row.id = (select id from order_ids where key = 'pillar_problem')
        ),
        'score',
        'Rate last criterion'
      )
    )
  ),
  'remaining Problem Solving criterion keeps a scored question'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_appended'),
    (
      select public.add_maturity_question(
        (select id from order_ids where key = 'version_a'),
        (
          select pillar_row.section_id
          from public.maturity_pillars pillar_row
          where pillar_row.id = (select id from order_ids where key = 'pillar_problem')
        ),
        'score',
        'Rate appended criterion'
      )
    )
  ),
  'appended criterion keeps a scored question'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"21000000-0000-4000-8000-000000000012","email":"order-member-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from order_ids where key = 'org_a')),
  'unauthorised member selects organisation A'
);

select throws_ok(
  format(
    'select public.reorder_maturity_pillar(%L::uuid, ''down'')',
    (select id from order_ids where key = 'pillar_leadership')
  ),
  '42501',
  'maturity framework structural edit is not authorised',
  'unauthorised member cannot reorder'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"21000000-0000-4000-8000-000000000011","email":"order-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from order_ids where key = 'org_a')),
  'owner resumes organisation A'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from order_ids where key = 'criterion_middle'),
    (
      select public.add_maturity_question(
        (select id from order_ids where key = 'version_a'),
        (
          select pillar_row.section_id
          from public.maturity_pillars pillar_row
          where pillar_row.id = (select id from order_ids where key = 'pillar_problem')
        ),
        'score',
        'Rate first remaining criterion'
      )
    )
  ),
  'first remaining Problem Solving criterion keeps a scored question'
);

select ok(
  public.publish_maturity_model_version((select id from order_ids where key = 'version_a')),
  'draft publishes with stable hierarchy order'
);

select throws_ok(
  format(
    'select public.reorder_maturity_pillar(%L::uuid, ''down'')',
    (select id from order_ids where key = 'pillar_leadership')
  ),
  '55000',
  'maturity pillar is not editable',
  'published version cannot be reordered'
);

select * from finish();
rollback;
