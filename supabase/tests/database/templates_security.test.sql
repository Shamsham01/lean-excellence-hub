begin;

select plan(9);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values (
  '71000000-0000-0000-0000-000000000001',
  'template-owner@example.test',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  false
);

create temporary table template_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on template_ids to authenticated;

insert into template_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '71000000-0000-0000-0000-000000000001',
    'template-org',
    'Template Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000001","email":"template-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from template_ids where key = 'organisation')),
  'template owner selects organisation'
);

insert into template_ids (key, id)
select 'template', public.create_template_draft('Safety checklist');

insert into template_ids (key, id)
select 'template_version', template_version.id
from public.template_versions template_version
where template_version.organisation_id = (
    select id from template_ids where key = 'organisation'
  )
  and template_version.template_id = (
    select id from template_ids where key = 'template'
  )
  and template_version.version_number = 1;

reset role;

select lives_ok(
  format(
    $query$
      insert into public.template_sections (
        organisation_id,
        template_version_id,
        title,
        position
      )
      values (
        %L::uuid,
        %L::uuid,
        'General',
        1
      )
    $query$,
    (select id from template_ids where key = 'organisation'),
    (select id from template_ids where key = 'template_version')
  ),
  'draft template versions accept section edits'
);

insert into template_ids (key, id)
select 'section', template_section.id
from public.template_sections template_section
where template_section.organisation_id = (
    select id from template_ids where key = 'organisation'
  )
  and template_section.template_version_id = (
    select id from template_ids where key = 'template_version'
  );

with inserted_question as (
  insert into public.template_questions (
    organisation_id,
    template_version_id,
    section_id,
    question_type,
    prompt,
    position,
    allows_not_applicable
  )
  values (
    (select id from template_ids where key = 'organisation'),
    (select id from template_ids where key = 'template_version'),
    (select id from template_ids where key = 'section'),
    'short_text',
    'Describe the hazard',
    1,
    true
  )
  returning id
)
insert into template_ids (key, id)
select 'question', id from inserted_question;

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000001","email":"template-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.publish_template_version(
    (select id from template_ids where key = 'template_version')
  ),
  'draft template version can be published'
);

reset role;

select throws_ok(
  format(
    $query$
      insert into public.template_sections (
        organisation_id,
        template_version_id,
        title,
        position
      )
      values (
        %L::uuid,
        %L::uuid,
        'Late section',
        2
      )
    $query$,
    (select id from template_ids where key = 'organisation'),
    (select id from template_ids where key = 'template_version')
  ),
  '55000',
  null,
  'published template versions are immutable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000001","email":"template-owner@example.test"}',
  true
);
set local role authenticated;

insert into template_ids (key, id)
select 'submission', public.create_template_submission(
  (select id from template_ids where key = 'template_version')
);

select lives_ok(
  format(
    'select public.upsert_template_answer(%L::uuid, %L::uuid, false, %L)',
    (select id from template_ids where key = 'submission'),
    (select id from template_ids where key = 'question'),
    'draft answer'
  ),
  'draft submission answer can be upserted'
);

select ok(
  exists (
    select 1
    from public.template_answers answer_row
    where answer_row.organisation_id = (select id from template_ids where key = 'organisation')
      and answer_row.submission_id = (select id from template_ids where key = 'submission')
      and answer_row.question_id = (select id from template_ids where key = 'question')
      and answer_row.text_value = 'draft answer'
  ),
  'authenticated user can read upserted template answers via RLS'
);

select ok(
  public.complete_template_submission(
    (select id from template_ids where key = 'submission')
  ),
  'draft submissions can be completed'
);

reset role;

select throws_ok(
  format(
    $query$
      insert into public.template_answers (
        organisation_id,
        submission_id,
        question_id,
        text_value
      )
      values (
        %L::uuid,
        %L::uuid,
        %L::uuid,
        'late answer'
      )
    $query$,
    (select id from template_ids where key = 'organisation'),
    (select id from template_ids where key = 'submission'),
    (select id from template_ids where key = 'question')
  ),
  '55000',
  null,
  'completed submissions reject answer mutations'
);

select ok(
  to_regclass('public.template_answer_people') is not null,
  'person answers use relational table'
);

select * from finish();
rollback;
