begin;

select plan(26);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'e1000000-0000-0000-0000-000000000001',
  'project-charter-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e1000000-0000-0000-0000-000000000002',
  'project-charter-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table charter_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on charter_ids to authenticated;

insert into charter_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000001',
    'project-charter-org',
    'Project Charter Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'e1100000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'e1100000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e1100000-0000-0000-0000-000000000001","email":"project-charter-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from charter_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into charter_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from charter_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into charter_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from charter_ids where key = 'organisation')
  and membership_row.user_id = 'e1000000-0000-0000-0000-000000000001';

insert into charter_ids (key, id)
select 'job_function', public.create_job_function('Charter Operator', 'charter-operator');

select ok(
  public.assign_membership_job_function(
    (select id from charter_ids where key = 'owner_membership'),
    (select id from charter_ids where key = 'job_function'),
    true,
    (select id from charter_ids where key = 'unit_root')
  ) is not null,
  'owner primary job assignment for suggestion submit scope'
);

insert into charter_ids (key, id)
select 'methodology', public.create_ci_project_methodology_draft(
  'Charter DMAIC',
  'charter-dmaic',
  'Charter methodology'
);

insert into charter_ids (key, id)
select 'methodology_version', version_row.id
from public.ci_project_methodology_versions version_row
where version_row.methodology_id = (select id from charter_ids where key = 'methodology')
  and version_row.version_number = 1;

select ok(
  public.add_ci_project_methodology_phase(
    (select id from charter_ids where key = 'methodology_version'),
    'define',
    'Define',
    1,
    'Define the problem'
  ) is not null,
  'methodology draft accepts a phase'
);

select ok(
  public.publish_ci_project_methodology_version(
    (select id from charter_ids where key = 'methodology_version')
  ),
  'methodology version publishes'
);

insert into charter_ids (key, id)
select 'incomplete_project', public.create_improvement_project(
  'Incomplete charter project',
  (select id from charter_ids where key = 'unit_root'),
  null,
  null,
  null
);

select throws_ok(
  format(
    'select public.submit_project(%L::uuid)',
    (select id from charter_ids where key = 'incomplete_project')
  ),
  '22023',
  'project charter is incomplete: problem statement, objective, methodology'
);

select ok(
  public.update_ci_project_draft(
    (select id from charter_ids where key = 'incomplete_project'),
    'Incomplete charter project',
    'Changeovers exceed target',
    'Reduce changeover time',
    null, null, null, null, null, null, null,
    (select id from charter_ids where key = 'methodology_version'),
    null, null, null
  ),
  'draft charter fields persist through the draft update RPC'
);

select throws_ok(
  format(
    'select public.submit_project(%L::uuid)',
    (select id from charter_ids where key = 'incomplete_project')
  ),
  '22023',
  'project requires exactly one active owner before submission'
);

select ok(
  public.assign_ci_project_team_member(
    (select id from charter_ids where key = 'incomplete_project'),
    (select id from charter_ids where key = 'owner_membership'),
    'owner'
  ) is not null,
  'draft project accepts an owner assignment'
);

select ok(
  public.submit_project((select id from charter_ids where key = 'incomplete_project')),
  'complete valid charter submits'
);

select is(
  (
    select project_row.status
    from public.ci_projects project_row
    where project_row.id = (select id from charter_ids where key = 'incomplete_project')
  ),
  'submitted',
  'successful submit records the submitted status'
);

select ok(
  exists (
    select 1
    from public.ci_project_status_history history_row
    where history_row.project_id = (select id from charter_ids where key = 'incomplete_project')
      and history_row.from_status = 'draft'
      and history_row.to_status = 'submitted'
      and history_row.changed_by_membership_id = (select id from charter_ids where key = 'owner_membership')
  ),
  'successful submit records actor and lifecycle history'
);

insert into charter_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into charter_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from charter_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from charter_ids where key = 'programme_version')
  ),
  'programme version publishes'
);

insert into charter_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into charter_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from charter_ids where key = 'programme_version'),
  (select id from charter_ids where key = 'category'),
  'Suggestion derived project',
  'Labels fall off during changeover',
  'Standardise holder positions',
  'Fewer quality escapes'
);

select ok(
  public.submit_suggestion((select id from charter_ids where key = 'suggestion')),
  'suggestion submits'
);

select ok(
  public.begin_suggestion_review((select id from charter_ids where key = 'suggestion')),
  'review begins'
);

select ok(
  public.record_suggestion_review(
    (select id from charter_ids where key = 'suggestion'),
    'accept',
    'medium',
    'low',
    'Accepted for a project',
    null,
    'Approved to become a project.'
  ) is not null,
  'accepted review decision recorded'
);

select ok(
  public.begin_suggestion_implementation((select id from charter_ids where key = 'suggestion')),
  'implementation phase begins'
);

insert into charter_ids (key, id)
select 'suggestion_project', public.create_improvement_project_from_suggestion(
  (select id from charter_ids where key = 'suggestion')
);

select is(
  (
    select jsonb_build_object(
      'title', project_row.title,
      'problem_statement', project_row.problem_statement,
      'objective', project_row.objective,
      'unit_id', project_row.unit_id
    )
    from public.ci_projects project_row
    where project_row.id = (select id from charter_ids where key = 'suggestion_project')
  ),
  jsonb_build_object(
    'title', 'Suggestion derived project',
    'problem_statement', 'Labels fall off during changeover',
    'objective', 'Standardise holder positions',
    'unit_id', (select id from charter_ids where key = 'unit_root')
  ),
  'suggestion-derived project inherits title, problem, objective, and unit'
);

select is(
  (
    select detail -> 'source_links' -> 0 ->> 'reference'
    from (
      select public.get_ci_project_detail(
        (select id from charter_ids where key = 'suggestion_project')
      ) as detail
    ) project_detail
  ),
  (
    select suggestion_row.suggestion_number
    from public.improvement_suggestions suggestion_row
    where suggestion_row.id = (select id from charter_ids where key = 'suggestion')
  ),
  'project detail exposes a human-readable suggestion source reference'
);

select isnt(
  (
    select detail -> 'linked_projects' -> 0 ->> 'project_number'
    from (
      select public.get_suggestion_detail(
        (select id from charter_ids where key = 'suggestion')
      ) as detail
    ) suggestion_detail
  ),
  null,
  'suggestion detail exposes a human-readable linked project number'
);

insert into charter_ids (key, id)
select 'benefit', public.create_benefit_from_ci_project(
  (select id from charter_ids where key = 'suggestion_project'),
  'non_financial',
  'Benefit from project',
  'Inherited lineage',
  null,
  'quality',
  null,
  null,
  null
);

select is(
  (
    select benefit_row.organisational_unit_id
    from public.improvement_benefits benefit_row
    where benefit_row.id = (select id from charter_ids where key = 'benefit')
  ),
  (select id from charter_ids where key = 'unit_root'),
  'benefit created from project inherits the project unit'
);

select is(
  (
    select detail -> 'source_links' -> 0 ->> 'display_label'
    from (
      select public.get_benefit_detail(
        (select id from charter_ids where key = 'benefit')
      ) as detail
    ) benefit_detail
  ),
  (
    select project_row.project_number
    from public.ci_projects project_row
    where project_row.id = (select id from charter_ids where key = 'suggestion_project')
  ),
  'benefit detail shows a human-readable project reference rather than a raw UUID'
);

select is(
  (
    select detail -> 'source_links' -> 0 ->> 'href'
    from (
      select public.get_benefit_detail(
        (select id from charter_ids where key = 'benefit')
      ) as detail
    ) benefit_detail
  ),
  '/platform/projects/' || (select id from charter_ids where key = 'suggestion_project'),
  'benefit detail links back to the source project when the caller can read it'
);

reset role;

insert into charter_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000002',
    'project-charter-org-b',
    'Project Charter Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"e1100000-0000-0000-0000-000000000002","email":"project-charter-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from charter_ids where key = 'organisation_b')),
  'outsider selects a different organisation'
);

select throws_ok(
  format(
    'select public.get_ci_project_detail(%L::uuid)',
    (select id from charter_ids where key = 'suggestion_project')
  ),
  '42501',
  'project detail is not authorised'
);

select throws_ok(
  format(
    'select public.get_benefit_detail(%L::uuid)',
    (select id from charter_ids where key = 'benefit')
  ),
  '42501',
  'benefit detail is not authorised'
);

select throws_ok(
  format(
    'select public.submit_project(%L::uuid)',
    (select id from charter_ids where key = 'incomplete_project')
  ),
  'P0002',
  'project not found'
);

select * from finish();
rollback;
