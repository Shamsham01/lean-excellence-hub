begin;

select plan(61);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '94000000-0000-0000-0000-000000000001',
    'gemba-applicability@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    'gemba-applicability-walker@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000005',
    'gemba-applicability-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table gemba_applicability_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on gemba_applicability_ids to authenticated;

insert into gemba_applicability_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '94000000-0000-0000-0000-000000000001',
    'gemba-applicability-org',
    'Gemba Applicability Organisation'
  )
);

insert into gemba_applicability_ids (key, id)
values (
  'foreign_organisation',
  private.provision_organisation(
    '94000000-0000-0000-0000-000000000005',
    'gemba-applicability-foreign-org',
    'Gemba Applicability Foreign Organisation'
  )
);

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from gemba_applicability_ids where key = 'organisation'),
  '94000000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '94000000-0000-0000-0000-000000000003';

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '94000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000004',
    '94000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000006',
    '94000000-0000-0000-0000-000000000005',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000006","email":"gemba-applicability-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_applicability_ids where key = 'foreign_organisation')
  ),
  'foreign owner selects organisation'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''foreign-site'', ''Foreign Site'', ''site'')',
    (select id from gemba_applicability_ids where key = 'foreign_organisation')
  ),
  'can create a unit in the foreign organisation'
);

insert into gemba_applicability_ids (key, id)
select 'foreign_site', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (
  select id from gemba_applicability_ids where key = 'foreign_organisation'
)
  and organisation_unit.code = 'foreign-site';

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000002","email":"gemba-applicability@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from gemba_applicability_ids where key = 'organisation')),
  'applicability owner selects organisation'
);

insert into gemba_applicability_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and membership_row.user_id = '94000000-0000-0000-0000-000000000001';

insert into gemba_applicability_ids (key, id)
select 'walker_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and membership_row.user_id = '94000000-0000-0000-0000-000000000003';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''exeter-site'', ''Exeter Cookie Factory'', ''site'')',
    (select id from gemba_applicability_ids where key = 'organisation')
  ),
  'can create Exeter site root'
);

insert into gemba_applicability_ids (key, id)
select 'exeter', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'exeter-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''packing'', ''Packing'', ''area'')',
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'exeter')
  ),
  'can create Exeter packing unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''baking'', ''Baking'', ''area'')',
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'exeter')
  ),
  'can create Exeter baking unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''quality'', ''Quality'', ''department'')',
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'exeter')
  ),
  'can create Exeter quality unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''bodmin-site'', ''Bodmin Cookie Factory'', ''site'')',
    (select id from gemba_applicability_ids where key = 'organisation')
  ),
  'can create Bodmin site root'
);

insert into gemba_applicability_ids (key, id)
select 'packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'packing';

insert into gemba_applicability_ids (key, id)
select 'baking', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'baking';

insert into gemba_applicability_ids (key, id)
select 'quality', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'quality';

insert into gemba_applicability_ids (key, id)
select 'bodmin', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'bodmin-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''bodmin-packing'', ''Packing'', ''area'')',
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'bodmin')
  ),
  'can create Bodmin packing unit'
);

insert into gemba_applicability_ids (key, id)
select 'bodmin_packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'bodmin-packing';

insert into gemba_applicability_ids (key, id)
select 'definition', public.create_gemba_definition_draft(
  'Exeter Packing Gemba Walk',
  'Packing-only applicability'
);

insert into gemba_applicability_ids (key, id)
select 'version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from gemba_applicability_ids where key = 'definition')
  and version_row.version_number = 1;

insert into gemba_applicability_ids (key, id)
select 'section', public.add_gemba_section(
  (select id from gemba_applicability_ids where key = 'version'),
  'Safety',
  1
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''What abnormal condition is visible?'', 1)',
    (select id from gemba_applicability_ids where key = 'version'),
    (select id from gemba_applicability_ids where key = 'section')
  ),
  'can add packing walk prompt'
);

select throws_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from gemba_applicability_ids where key = 'version')
  ),
  '55000',
  'gemba definition requires at least one applicable organisational unit',
  'new definition cannot publish before applicability is assigned'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[]::uuid[])',
    (select id from gemba_applicability_ids where key = 'definition')
  ),
  '22023',
  'gemba definition requires at least one applicable organisational unit',
  'empty applicability assignment is rejected'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'foreign_site')
  ),
  '23503',
  'gemba definition applicability includes an invalid organisational unit',
  'cross-organisation applicability assignment is rejected'
);

select ok(
  public.set_gemba_definition_applicable_units(
    (select id from gemba_applicability_ids where key = 'definition'),
    array[(select id from gemba_applicability_ids where key = 'packing')]
  ),
  'can assign Exeter packing-only applicability'
);

select ok(
  public.publish_gemba_definition_version((select id from gemba_applicability_ids where key = 'version')),
  'can publish after applicability is assigned'
);

insert into gemba_applicability_ids (key, id)
select 'packing_walk', public.start_gemba_walk(
  (select id from gemba_applicability_ids where key = 'definition'),
  (select id from gemba_applicability_ids where key = 'packing')
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'authorised baking unit is rejected for packing-only definition'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'quality')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'authorised quality unit is rejected for packing-only definition'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'exeter')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'site root is rejected unless explicitly applicable'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'bodmin_packing')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'authorised Bodmin packing unit is rejected for Exeter packing-only definition'
);

reset role;

select throws_ok(
  format(
    $sql$
      insert into public.gemba_definition_applicable_units (
        organisation_id, definition_id, unit_id
      ) values (%L::uuid, %L::uuid, %L::uuid)
    $sql$,
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'packing')
  ),
  '23505',
  'duplicate key value violates unique constraint "gemba_definition_applicable_units_definition_unit_key"',
  'duplicate applicability mapping is prevented'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000004","email":"gemba-applicability-walker@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from gemba_applicability_ids where key = 'organisation')),
  'unprivileged walker selects organisation'
);

select ok(
  not public.member_has_permission('gemba.walk.perform'),
  'unprivileged walker does not receive gemba.walk.perform from applicability'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'packing')
  ),
  '42501',
  'gemba walk start is not authorised',
  'applicability does not grant walk permission'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000002","email":"gemba-applicability@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from gemba_applicability_ids where key = 'organisation')),
  'owner resumes organisation context'
);

select throws_ok(
  format(
    $sql$
      select public.create_schedule_definition(
        %L::uuid,
        'Quality Gemba schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'quality'),
    (select id from gemba_applicability_ids where key = 'membership')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'schedule create rejects a unit outside applicability'
);

insert into gemba_applicability_ids (key, id)
select 'packing_schedule', public.create_schedule_definition(
  (select id from gemba_applicability_ids where key = 'definition'),
  'Packing Gemba schedule',
  (select id from gemba_applicability_ids where key = 'packing'),
  (select id from gemba_applicability_ids where key = 'membership'),
  '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
  current_date,
  true
);

select ok(
  (select id from gemba_applicability_ids where key = 'packing_schedule') is not null,
  'schedule create accepts an applicable packing unit'
);

select throws_ok(
  format(
    $sql$
      select public.update_schedule_definition(
        %L::uuid,
        'Packing Gemba schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from gemba_applicability_ids where key = 'packing_schedule'),
    (select id from gemba_applicability_ids where key = 'baking'),
    (select id from gemba_applicability_ids where key = 'membership')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'schedule edit rejects a unit outside applicability'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking')
  ),
  '22023',
  'Cannot remove Gemba applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.',
  'cannot remove packing applicability while an active packing schedule exists'
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
          join public.gemba_definition_versions version_row
            on version_row.template_version_id = question.template_version_id
          where version_row.id = %L::uuid
        loop
          perform public.upsert_gemba_walk_answer(
            %L::uuid,
            question_row.id,
            false,
            'Observed packing controls'
          );
        end loop;
      end
      $inner$;
    $$,
    (select id from gemba_applicability_ids where key = 'version'),
    (select id from gemba_applicability_ids where key = 'packing_walk')
  ),
  'can answer historical packing walk'
);

select lives_ok(
  format(
    'select public.complete_gemba_walk(%L::uuid)',
    (select id from gemba_applicability_ids where key = 'packing_walk')
  ),
  'can complete historical packing walk'
);

select ok(
  public.set_gemba_definition_applicable_units(
    (select id from gemba_applicability_ids where key = 'definition'),
    array[
      (select id from gemba_applicability_ids where key = 'packing'),
      (select id from gemba_applicability_ids where key = 'baking')
    ]
  ),
  'can expand applicability to packing and baking'
);

insert into gemba_applicability_ids (key, id)
select 'packing_occurrence', occurrence_row.id
from public.schedule_occurrences occurrence_row
where occurrence_row.schedule_definition_id = (
  select id from gemba_applicability_ids where key = 'packing_schedule'
)
  and occurrence_row.lifecycle_status = 'open'
order by occurrence_row.planned_local_date
limit 1;

select ok(
  (select id from gemba_applicability_ids where key = 'packing_occurrence') is not null,
  'packing schedule has an open occurrence'
);

insert into gemba_applicability_ids (key, id)
select 'baking_schedule', public.create_schedule_definition(
  (select id from gemba_applicability_ids where key = 'definition'),
  'Baking Gemba schedule',
  (select id from gemba_applicability_ids where key = 'baking'),
  (select id from gemba_applicability_ids where key = 'membership'),
  '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
  current_date,
  true
);

insert into gemba_applicability_ids (key, id)
select 'baking_occurrence', occurrence_row.id
from public.schedule_occurrences occurrence_row
where occurrence_row.schedule_definition_id = (
  select id from gemba_applicability_ids where key = 'baking_schedule'
)
  and occurrence_row.lifecycle_status = 'open'
order by occurrence_row.planned_local_date
limit 1;

select ok(
  (select id from gemba_applicability_ids where key = 'baking_occurrence') is not null,
  'baking schedule has an open occurrence'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking'),
    (select id from gemba_applicability_ids where key = 'packing_occurrence')
  ),
  '55000',
  'schedule occurrence is not valid for this gemba definition',
  'start walk rejects a packing occurrence bound to a baking unit'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'packing'),
    (select id from gemba_applicability_ids where key = 'baking_occurrence')
  ),
  '55000',
  'schedule occurrence is not valid for this gemba definition',
  'start walk rejects a baking occurrence bound to a packing unit'
);

insert into gemba_applicability_ids (key, id)
select 'packing_scheduled_walk', public.start_gemba_walk(
  (select id from gemba_applicability_ids where key = 'definition'),
  (select id from gemba_applicability_ids where key = 'packing'),
  (select id from gemba_applicability_ids where key = 'packing_occurrence')
);

select is(
  (
    select walk_row.unit_id
    from public.gemba_walks walk_row
    where walk_row.id = (
      select id from gemba_applicability_ids where key = 'packing_scheduled_walk'
    )
  ),
  (select id from gemba_applicability_ids where key = 'packing'),
  'matching occurrence start stays bound to the occurrence unit'
);

select is(
  (
    select walk_row.schedule_occurrence_id
    from public.gemba_walks walk_row
    where walk_row.id = (
      select id from gemba_applicability_ids where key = 'packing_scheduled_walk'
    )
  ),
  (select id from gemba_applicability_ids where key = 'packing_occurrence'),
  'matching occurrence start records the occurrence used'
);

insert into gemba_applicability_ids (key, id)
select 'baking_walk', public.start_gemba_walk(
  (select id from gemba_applicability_ids where key = 'definition'),
  (select id from gemba_applicability_ids where key = 'baking')
);

select ok(
  public.deactivate_schedule_definition(
    (select id from gemba_applicability_ids where key = 'packing_schedule')
  ),
  'can deactivate packing schedule before removing packing applicability'
);

select ok(
  public.set_gemba_definition_applicable_units(
    (select id from gemba_applicability_ids where key = 'definition'),
    array[(select id from gemba_applicability_ids where key = 'baking')]
  ),
  'later applicability change does not rewrite historical walks'
);

select lives_ok(
  format(
    'select public.create_gemba_definition_successor_version(%L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition')
  ),
  'successor version inherits definition-level applicability'
);

select is(
  (
    select count(*)::integer
    from public.gemba_definition_applicable_units applicability_row
    where applicability_row.definition_id = (
      select id from gemba_applicability_ids where key = 'definition'
    )
      and applicability_row.unit_id = (select id from gemba_applicability_ids where key = 'baking')
  ),
  1,
  'successor creation does not orphan or copy applicability onto a new definition'
);

select is(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_applicability_ids where key = 'packing_walk')
  ),
  'completed',
  'historical completed walk remains readable after applicability change'
);

select is(
  (
    select walk_row.unit_id
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_applicability_ids where key = 'packing_walk')
  ),
  (select id from gemba_applicability_ids where key = 'packing'),
  'historical walk stays bound to the unit actually walked'
);

select is(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_applicability_ids where key = 'baking_walk')
  ),
  'in_progress',
  'in-progress walk remains readable after applicability change'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'packing')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'future starts follow the updated applicability'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''retired-area'', ''Retired Area'', ''area'')',
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'exeter')
  ),
  'can create unit that will be retired'
);

insert into gemba_applicability_ids (key, id)
select 'retired_area', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
  and organisation_unit.code = 'retired-area';

select ok(
  public.set_organisation_unit_status(
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'retired_area'),
    'retired',
    'Issue 78 inactive applicability coverage'
  ),
  'can retire unused organisational unit'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[%L::uuid, %L::uuid])',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking'),
    (select id from gemba_applicability_ids where key = 'retired_area')
  ),
  '22023',
  'gemba definition applicability includes an inactive organisational unit',
  'assigning an inactive unit is rejected'
);

select ok(
  public.set_organisation_unit_status(
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'baking'),
    'retired',
    'Issue 78 future execution fail-closed'
  ),
  'can retire previously applicable baking unit'
);

select throws_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'future walk start rejects a unit that became inactive after assignment'
);

select throws_ok(
  format(
    $sql$
      select public.create_schedule_definition(
        %L::uuid,
        'Inactive baking Gemba schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from gemba_applicability_ids where key = 'definition'),
    (select id from gemba_applicability_ids where key = 'baking'),
    (select id from gemba_applicability_ids where key = 'membership')
  ),
  '22023',
  'gemba definition is not applicable to the selected organisational unit',
  'schedule create rejects an inactive unit even if a mapping row remains'
);

select is(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_applicability_ids where key = 'baking_walk')
  ),
  'in_progress',
  'historical in-progress walk remains readable after the unit is retired'
);

insert into gemba_applicability_ids (key, id)
select 'atomic_definition', public.create_gemba_definition_draft(
  'Atomic Packing Gemba Walk',
  'Created with initial applicability',
  30,
  array[(select id from gemba_applicability_ids where key = 'packing')]
);

select is(
  (
    select count(*)::integer
    from public.gemba_definition_applicable_units applicability_row
    where applicability_row.definition_id = (
      select id from gemba_applicability_ids where key = 'atomic_definition'
    )
      and applicability_row.unit_id = (select id from gemba_applicability_ids where key = 'packing')
  ),
  1,
  'atomic create persists initial applicability in the same transaction'
);

insert into gemba_applicability_ids (key, id)
select 'atomic_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from gemba_applicability_ids where key = 'atomic_definition')
  and version_row.version_number = 1;

insert into gemba_applicability_ids (key, id)
select 'atomic_section', public.add_gemba_section(
  (select id from gemba_applicability_ids where key = 'atomic_version'),
  'Safety',
  1
);

select public.add_gemba_question(
  (select id from gemba_applicability_ids where key = 'atomic_version'),
  (select id from gemba_applicability_ids where key = 'atomic_section'),
  'short_text',
  'What did you observe?',
  1
);

select throws_ok(
  format(
    'select public.create_gemba_definition_draft(%L, %L, 30, array[%L::uuid])',
    'Orphan Draft Gemba Walk',
    'Must not persist if applicability fails',
    '94000000-0000-0000-0000-000000000099'
  ),
  '23503',
  'gemba definition applicability includes an invalid organisational unit',
  'atomic create rejects invalid initial applicability'
);

select is(
  (
    select count(*)::integer
    from public.gemba_definitions definition_row
    where definition_row.organisation_id = (select id from gemba_applicability_ids where key = 'organisation')
      and definition_row.display_name = 'Orphan Draft Gemba Walk'
  ),
  0,
  'failed atomic create does not leave an orphan draft'
);

select ok(
  public.set_organisation_unit_status(
    (select id from gemba_applicability_ids where key = 'organisation'),
    (select id from gemba_applicability_ids where key = 'packing'),
    'retired',
    'Issue 78 stale applicability remediation'
  ),
  'can retire previously applicable packing unit'
);

select throws_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from gemba_applicability_ids where key = 'atomic_version')
  ),
  '55000',
  'gemba definition requires at least one applicable organisational unit',
  'publish stays blocked when only inactive mappings remain'
);

select throws_ok(
  format(
    'select public.set_gemba_definition_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from gemba_applicability_ids where key = 'atomic_definition'),
    (select id from gemba_applicability_ids where key = 'packing')
  ),
  '22023',
  'gemba definition applicability includes an inactive organisational unit',
  'newly assigning an inactive unit still fails at the DB boundary'
);

select ok(
  public.set_gemba_definition_applicable_units(
    (select id from gemba_applicability_ids where key = 'atomic_definition'),
    array[(select id from gemba_applicability_ids where key = 'quality')]
  ),
  'saving applicability can remediate a retired mapping with an active unit'
);

select is(
  (
    select count(*)::integer
    from public.gemba_definition_applicable_units applicability_row
    where applicability_row.definition_id = (
      select id from gemba_applicability_ids where key = 'atomic_definition'
    )
      and applicability_row.unit_id = (select id from gemba_applicability_ids where key = 'packing')
  ),
  0,
  'remediation save no longer keeps the retired packing mapping'
);

select is(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_applicability_ids where key = 'packing_walk')
  ),
  'completed',
  'historical completed packing walk remains readable after packing is retired'
);

select * from finish();
rollback;
