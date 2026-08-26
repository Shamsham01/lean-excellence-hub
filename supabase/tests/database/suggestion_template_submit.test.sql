begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c1200000-0000-0000-0000-000000000001',
  'template-submit-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table template_submit_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on template_submit_ids to authenticated;

insert into template_submit_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1200000-0000-0000-0000-000000000001',
    'template-submit-org',
    'Template Submit Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c1300000-0000-0000-0000-000000000001',
  'c1200000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1200000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1300000-0000-0000-0000-000000000001","email":"template-submit-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from template_submit_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into template_submit_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from template_submit_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into template_submit_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select membership_table.id
     from public.organisation_memberships membership_table
     where membership_table.organisation_id = (select id from template_submit_ids where key = 'organisation')
       and membership_table.user_id = 'c1200000-0000-0000-0000-000000000001'),
    (select id from template_submit_ids where key = 'job_function'),
    true,
    (select id from template_submit_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment for submit scope'
);

insert into template_submit_ids (key, id)
select 'template', public.create_template_draft('Suggestion intake form');

insert into template_submit_ids (key, id)
select 'template_version', template_version.id
from public.template_versions template_version
where template_version.template_id = (select id from template_submit_ids where key = 'template')
  and template_version.version_number = 1;

reset role;

update public.templates template_table
set experience_type = 'improvement_suggestion'
where template_table.id = (select id from template_submit_ids where key = 'template');

select set_config(
  'request.jwt.claims',
  '{"sub":"c1200000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1300000-0000-0000-0000-000000000001","email":"template-submit-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.publish_template_version((select id from template_submit_ids where key = 'template_version')),
  'suggestion template version publishes'
);

insert into template_submit_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Template Programme',
  'template-programme'
);

insert into template_submit_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from template_submit_ids where key = 'programme')
  and programme_version.version_number = 1;

reset role;

update public.suggestion_programme_versions version_table
set template_version_id = (select id from template_submit_ids where key = 'template_version')
where version_table.id = (select id from template_submit_ids where key = 'programme_version');

select set_config(
  'request.jwt.claims',
  '{"sub":"c1200000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1300000-0000-0000-0000-000000000001","email":"template-submit-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.publish_suggestion_programme_version((select id from template_submit_ids where key = 'programme_version')),
  'programme with template publishes'
);

insert into template_submit_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into template_submit_ids (key, id)
select 'template_submission', public.create_template_submission(
  (select id from template_submit_ids where key = 'template_version')
);

insert into template_submit_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from template_submit_ids where key = 'programme_version'),
  (select id from template_submit_ids where key = 'category'),
  'Template-backed suggestion',
  'Loose labels on the line',
  'Use colour-coded holders',
  'Safer changeovers',
  null,
  (select id from template_submit_ids where key = 'template_submission')
);

select ok(
  public.submit_suggestion((select id from template_submit_ids where key = 'suggestion')),
  'template-backed suggestion submits'
);

select is(
  (select status from public.template_submissions
   where id = (select id from template_submit_ids where key = 'template_submission')),
  'completed',
  'submit finalises linked template submission'
);

select * from finish();
rollback;
