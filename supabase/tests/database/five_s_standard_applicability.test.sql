begin;

select plan(24);

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

select ok(
  public.publish_five_s_standard_version((select id from applicability_ids where key = 'version')),
  'can publish standard before applicability is assigned'
);

select throws_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'packing')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'missing applicability fails closed'
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

select lives_ok(
  format(
    $sql$
      select public.create_schedule_definition(
        %L::uuid,
        'Packing 5S schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from applicability_ids where key = 'standard'),
    (select id from applicability_ids where key = 'packing'),
    (select id from applicability_ids where key = 'membership')
  ),
  'schedule create accepts an applicable packing unit'
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

select * from finish();
rollback;
