begin;

select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '91000000-0000-0000-0000-000000000001',
  'five-s-scoring@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table five_s_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on five_s_ids to authenticated;

insert into five_s_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '91000000-0000-0000-0000-000000000001',
    'five-s-scoring-org',
    'Five S Scoring Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000001","email":"five-s-scoring@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from five_s_ids where key = 'organisation')),
  'five_s owner selects organisation'
);

insert into five_s_ids (key, id)
select 'standard', public.create_five_s_standard_draft('Scoring Standard', 'Scoring test', 90);

insert into five_s_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from five_s_ids where key = 'standard')
  and version_row.version_number = 1;

insert into five_s_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from five_s_ids where key = 'version'),
  'Sort',
  1
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Meets standard?'', 1, true, false, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from five_s_ids where key = 'version'),
    (select id from five_s_ids where key = 'section')
  ),
  'can add scored yes_no question'
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from five_s_ids where key = 'version')
  ),
  'can publish five_s standard'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''five-s-unit'', ''Five S Unit'', ''site'')',
    (select id from five_s_ids where key = 'organisation')
  ),
  'can create unit for five_s audit scope'
);

insert into five_s_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from five_s_ids where key = 'organisation')
  and organisation_unit.code = 'five-s-unit';

insert into five_s_ids (key, id)
select 'audit', public.start_five_s_audit(
  (select id from five_s_ids where key = 'standard'),
  (select id from five_s_ids where key = 'unit')
);

select lives_ok(
  format(
    $$
      do $inner$
      declare
        question_row record;
      begin
        for question_row in
          select question.id
          from public.template_questions question
          join public.five_s_standard_versions version_row
            on version_row.template_version_id = question.template_version_id
          where version_row.id = %L::uuid
        loop
          perform public.upsert_five_s_audit_answer(
            %L::uuid,
            question_row.id,
            false,
            'yes',
            null
          );
        end loop;
      end
      $inner$;
    $$,
    (select id from five_s_ids where key = 'version'),
    (select id from five_s_ids where key = 'audit')
  ),
  'can answer all scored questions yes'
);

select lives_ok(
  format(
    'select public.complete_five_s_audit(%L::uuid)',
    (select id from five_s_ids where key = 'audit')
  ),
  'can complete five_s audit'
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from five_s_ids where key = 'audit')
  ),
  100::numeric,
  'all yes answers produce 100 percent overall score'
);

select * from finish();
rollback;
