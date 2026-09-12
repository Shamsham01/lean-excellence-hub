begin;

select plan(38);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '93000000-0000-0000-0000-000000000001',
  'five-s-applicability@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table applicability_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on applicability_ids to authenticated;

insert into applicability_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93000000-0000-0000-0000-000000000001',
    'five-s-applicability-org',
    'Five S Applicability Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '93000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93000000-0000-0000-0000-000000000002","email":"five-s-applicability@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from applicability_ids where key = 'organisation')),
  'applicability owner selects organisation'
);

insert into applicability_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from applicability_ids where key = 'organisation')
  and membership_row.user_id = '93000000-0000-0000-0000-000000000001';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''exeter-site'', ''Exeter Cookie Factory'', ''site'')',
    (select id from applicability_ids where key = 'organisation')
  ),
  'can create site root'
);

insert into applicability_ids (key, id)
select 'site', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from applicability_ids where key = 'organisation')
  and organisation_unit.code = 'exeter-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''packing'', ''Packing'', ''area'')',
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'site')
  ),
  'can create packing unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''baking'', ''Baking'', ''area'')',
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'site')
  ),
  'can create baking unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''quality'', ''Quality'', ''department'')',
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'site')
  ),
  'can create quality unit'
);

insert into applicability_ids (key, id)
select 'packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from applicability_ids where key = 'organisation')
  and organisation_unit.code = 'packing';

insert into applicability_ids (key, id)
select 'baking', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from applicability_ids where key = 'organisation')
  and organisation_unit.code = 'baking';

insert into applicability_ids (key, id)
select 'quality', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from applicability_ids where key = 'organisation')
  and organisation_unit.code = 'quality';

insert into applicability_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Exeter Packing 5S Standard',
  'Packing-only applicability',
  90
);

insert into applicability_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from applicability_ids where key = 'standard')
  and version_row.version_number = 1;

insert into applicability_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from applicability_ids where key = 'version'),
  'Sort',
  1
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Is packing sorted?'', 1, true, false, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from applicability_ids where key = 'version'),
    (select id from applicability_ids where key = 'section')
  ),
  'can add packing question'
);

select throws_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from applicability_ids where key = 'version')
  ),
  '55000',
  '5S standard requires at least one applicable organisational unit',
  'new standard cannot publish before applicability is assigned'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_applicable_units(%L::uuid, array[]::uuid[])',
    (select id from applicability_ids where key = 'standard')
  ),
  '22023',
  '5S standard requires at least one applicable organisational unit',
  'empty applicability assignment is rejected'
);

select ok(
  public.set_five_s_standard_applicable_units(
    (select id from applicability_ids where key = 'standard'),
    array[(select id from applicability_ids where key = 'packing')]
  ),
  'can assign packing-only applicability'
);

select ok(
  public.publish_five_s_standard_version((select id from applicability_ids where key = 'version')),
  'can publish after applicability is assigned'
);

insert into applicability_ids (key, id)
select 'packing_audit', public.start_five_s_audit(
  (select id from applicability_ids where key = 'standard'),
  (select id from applicability_ids where key = 'packing')
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'baking')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'authorised baking unit is rejected for packing-only standard'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'quality')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'authorised quality unit is rejected for packing-only standard'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'site')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'site root is rejected unless explicitly applicable'
);

select throws_ok(
  format(
    $sql$
      select public.create_schedule_definition(
        %L::uuid,
        'Quality 5S schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'quality'),
    (select id from applicability_ids where key = 'membership')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'schedule create rejects a unit outside applicability'
);

insert into applicability_ids (key, id)
select 'packing_schedule', public.create_schedule_definition(
  (select id from applicability_ids where key = 'standard'),
  'Packing 5S schedule',
  (select id from applicability_ids where key = 'packing'),
  (select id from applicability_ids where key = 'membership'),
  '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
  current_date,
  true
);

select ok(
  (select id from applicability_ids where key = 'packing_schedule') is not null,
  'schedule create accepts an applicable packing unit'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'baking')
  ),
  '22023',
  'Cannot remove 5S applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.',
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
    (select id from applicability_ids where key = 'version'),
    (select id from applicability_ids where key = 'packing_audit')
  ),
  'can answer historical packing audit'
);

select lives_ok(
  format(
    'select public.complete_five_s_audit(%L::uuid)',
    (select id from applicability_ids where key = 'packing_audit')
  ),
  'can complete historical packing audit'
);

select ok(
  public.set_five_s_standard_applicable_units(
    (select id from applicability_ids where key = 'standard'),
    array[
      (select id from applicability_ids where key = 'packing'),
      (select id from applicability_ids where key = 'baking')
    ]
  ),
  'can expand applicability to packing and baking'
);

insert into applicability_ids (key, id)
select 'baking_audit', public.start_five_s_audit(
  (select id from applicability_ids where key = 'standard'),
  (select id from applicability_ids where key = 'baking')
);

select ok(
  public.deactivate_schedule_definition(
    (select id from applicability_ids where key = 'packing_schedule')
  ),
  'can deactivate packing schedule before removing packing applicability'
);

select ok(
  public.set_five_s_standard_applicable_units(
    (select id from applicability_ids where key = 'standard'),
    array[(select id from applicability_ids where key = 'baking')]
  ),
  'later applicability change does not rewrite historical audits'
);

select lives_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from applicability_ids where key = 'standard')
  ),
  'successor version inherits standard-level applicability'
);

select is(
  (
    select audit_row.status
    from public.five_s_audits audit_row
    where audit_row.id = (select id from applicability_ids where key = 'packing_audit')
  ),
  'completed',
  'historical completed audit remains readable after applicability change'
);

select is(
  (
    select audit_row.unit_id
    from public.five_s_audits audit_row
    where audit_row.id = (select id from applicability_ids where key = 'packing_audit')
  ),
  (select id from applicability_ids where key = 'packing'),
  'historical audit stays bound to the unit actually audited'
);

select is(
  (
    select audit_row.status
    from public.five_s_audits audit_row
    where audit_row.id = (select id from applicability_ids where key = 'baking_audit')
  ),
  'in_progress',
  'in-progress audit remains readable after applicability change'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'packing')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'future starts follow the updated applicability'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''retired-area'', ''Retired Area'', ''area'')',
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'site')
  ),
  'can create unit that will be retired'
);

insert into applicability_ids (key, id)
select 'retired_area', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from applicability_ids where key = 'organisation')
  and organisation_unit.code = 'retired-area';

select ok(
  public.set_organisation_unit_status(
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'retired_area'),
    'retired',
    'Issue 75 inactive applicability coverage'
  ),
  'can retire unused organisational unit'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_applicable_units(%L::uuid, array[%L::uuid, %L::uuid])',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'baking'),
    (select id from applicability_ids where key = 'retired_area')
  ),
  '22023',
  '5S standard applicability includes an inactive organisational unit',
  'assigning an inactive unit is rejected'
);

select ok(
  public.set_organisation_unit_status(
    (select id from applicability_ids where key = 'organisation'),
    (select id from applicability_ids where key = 'baking'),
    'retired',
    'Issue 75 future execution fail-closed'
  ),
  'can retire previously applicable baking unit'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'baking')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'future audit start rejects a unit that became inactive after assignment'
);

select throws_ok(
  format(
    $sql$
      select public.create_schedule_definition(
        %L::uuid,
        'Inactive baking 5S schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'baking'),
    (select id from applicability_ids where key = 'membership')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'schedule create rejects an inactive unit even if a mapping row remains'
);

select is(
  (
    select audit_row.status
    from public.five_s_audits audit_row
    where audit_row.id = (select id from applicability_ids where key = 'baking_audit')
  ),
  'in_progress',
  'historical in-progress audit remains readable after the unit is retired'
);

insert into applicability_ids (key, id)
select 'atomic_standard', public.create_five_s_standard_draft(
  'Atomic Packing 5S Standard',
  'Created with initial applicability',
  90,
  array[(select id from applicability_ids where key = 'packing')]
);

select is(
  (
    select count(*)::integer
    from public.five_s_standard_applicable_units applicability_row
    where applicability_row.standard_id = (
      select id from applicability_ids where key = 'atomic_standard'
    )
      and applicability_row.unit_id = (select id from applicability_ids where key = 'packing')
  ),
  1,
  'atomic create persists initial applicability in the same transaction'
);

select throws_ok(
  format(
    'select public.create_five_s_standard_draft(%L, %L, 90, array[%L::uuid])',
    'Orphan Draft 5S Standard',
    'Must not persist if applicability fails',
    '93000000-0000-0000-0000-000000000099'
  ),
  '23503',
  '5S standard applicability includes an invalid organisational unit',
  'atomic create rejects invalid initial applicability'
);

select is(
  (
    select count(*)::integer
    from public.five_s_standards standard_row
    where standard_row.organisation_id = (select id from applicability_ids where key = 'organisation')
      and standard_row.display_name = 'Orphan Draft 5S Standard'
  ),
  0,
  'failed atomic create does not leave an orphan draft'
);

insert into applicability_ids (key, id)
select 'legacy_standard', public.create_five_s_standard_draft(
  'Legacy Published 5S Standard',
  'Simulates pre-migration published standard',
  90
);

insert into applicability_ids (key, id)
select 'legacy_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from applicability_ids where key = 'legacy_standard')
  and version_row.version_number = 1;

insert into applicability_ids (key, id)
select 'legacy_section', public.add_five_s_section(
  (select id from applicability_ids where key = 'legacy_version'),
  'Sort',
  1
);

select public.add_five_s_question(
  (select id from applicability_ids where key = 'legacy_version'),
  (select id from applicability_ids where key = 'legacy_section'),
  'yes_no',
  'Is the area sorted?',
  1,
  true,
  false,
  null,
  null,
  true,
  '{"type":"yes_no","yes_value":100,"no_value":0}'::jsonb,
  1
);

select public.set_five_s_standard_applicable_units(
  (select id from applicability_ids where key = 'legacy_standard'),
  array[(select id from applicability_ids where key = 'packing')]
);

select public.publish_five_s_standard_version(
  (select id from applicability_ids where key = 'legacy_version')
);

reset role;

delete from public.five_s_standard_applicable_units
where organisation_id = (select id from applicability_ids where key = 'organisation')
  and standard_id = (select id from applicability_ids where key = 'legacy_standard');

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93000000-0000-0000-0000-000000000002","email":"five-s-applicability@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select version_row.status
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from applicability_ids where key = 'legacy_version')
  ),
  'published',
  'legacy published standard remains published after applicability is missing'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'legacy_standard'),
    (select id from applicability_ids where key = 'packing')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'legacy published standard without applicability stays fail-closed for execution'
);

select * from finish();
rollback;
