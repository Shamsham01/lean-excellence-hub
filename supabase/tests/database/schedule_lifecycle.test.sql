begin;

select plan(24);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '96000000-0000-0000-0000-000000000001',
  'schedule-lifecycle@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table schedule_lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on schedule_lifecycle_ids to authenticated, lean_hub_private_owner;

insert into schedule_lifecycle_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '96000000-0000-0000-0000-000000000001',
    'schedule-lifecycle-org',
    'Schedule Lifecycle Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '96000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"schedule-lifecycle@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from schedule_lifecycle_ids where key = 'organisation')),
  'lifecycle owner selects organisation'
);

insert into schedule_lifecycle_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from schedule_lifecycle_ids where key = 'organisation')
  and membership_row.user_id = '96000000-0000-0000-0000-000000000001';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''exeter-site'', ''Exeter Cookie Factory'', ''site'')',
    (select id from schedule_lifecycle_ids where key = 'organisation')
  ),
  'can create site root'
);

insert into schedule_lifecycle_ids (key, id)
select 'site', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from schedule_lifecycle_ids where key = 'organisation')
  and organisation_unit.code = 'exeter-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''packing'', ''Packing'', ''area'')',
    (select id from schedule_lifecycle_ids where key = 'organisation'),
    (select id from schedule_lifecycle_ids where key = 'site')
  ),
  'can create packing unit'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''baking'', ''Baking'', ''area'')',
    (select id from schedule_lifecycle_ids where key = 'organisation'),
    (select id from schedule_lifecycle_ids where key = 'site')
  ),
  'can create baking unit'
);

insert into schedule_lifecycle_ids (key, id)
select 'packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from schedule_lifecycle_ids where key = 'organisation')
  and organisation_unit.code = 'packing';

insert into schedule_lifecycle_ids (key, id)
select 'baking', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from schedule_lifecycle_ids where key = 'organisation')
  and organisation_unit.code = 'baking';

insert into schedule_lifecycle_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Lifecycle 5S Standard',
  'Packing-only schedule tests',
  90
);

insert into schedule_lifecycle_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from schedule_lifecycle_ids where key = 'standard')
  and version_row.version_number = 1;

insert into schedule_lifecycle_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from schedule_lifecycle_ids where key = 'version'),
  'Sort',
  1
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Is packing sorted?'', 1, true, false, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from schedule_lifecycle_ids where key = 'version'),
    (select id from schedule_lifecycle_ids where key = 'section')
  ),
  'can add packing question'
);

select ok(
  public.set_five_s_standard_applicable_units(
    (select id from schedule_lifecycle_ids where key = 'standard'),
    array[(select id from schedule_lifecycle_ids where key = 'packing')]
  ),
  'can assign packing-only applicability'
);

select ok(
  public.publish_five_s_standard_version((select id from schedule_lifecycle_ids where key = 'version')),
  'can publish after applicability is assigned'
);

insert into schedule_lifecycle_ids (key, id)
select 'once_schedule', public.create_schedule_definition(
  (select id from schedule_lifecycle_ids where key = 'standard'),
  'Once packing schedule',
  (select id from schedule_lifecycle_ids where key = 'packing'),
  (select id from schedule_lifecycle_ids where key = 'membership'),
  '{"frequency":"once","interval":1}'::jsonb,
  current_date,
  true
);

insert into schedule_lifecycle_ids (key, id)
select 'weekly_schedule', public.create_schedule_definition(
  (select id from schedule_lifecycle_ids where key = 'standard'),
  'Weekly packing schedule',
  (select id from schedule_lifecycle_ids where key = 'packing'),
  (select id from schedule_lifecycle_ids where key = 'membership'),
  '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
  (current_date - 14),
  true
);

insert into schedule_lifecycle_ids (key, id)
select 'monthly_schedule', public.create_schedule_definition(
  (select id from schedule_lifecycle_ids where key = 'standard'),
  'Monthly packing schedule',
  (select id from schedule_lifecycle_ids where key = 'packing'),
  (select id from schedule_lifecycle_ids where key = 'membership'),
  '{"frequency":"monthly","interval":1,"monthly_day":1}'::jsonb,
  date_trunc('month', current_date)::date,
  true
);

select ok(
  (select count(*) from public.schedule_definitions) >= 3,
  'create once, weekly, and monthly schedule definitions'
);

select throws_ok(
  format(
    $sql$
      select public.update_schedule_definition(
        %L::uuid,
        'Once packing schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"once","interval":1}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from schedule_lifecycle_ids where key = 'once_schedule'),
    (select id from schedule_lifecycle_ids where key = 'baking'),
    (select id from schedule_lifecycle_ids where key = 'membership')
  ),
  '22023',
  '5S standard is not applicable to the selected organisational unit',
  'schedule edit rejects a unit outside applicability'
);

reset role;
set local role lean_hub_private_owner;

insert into schedule_lifecycle_ids (key, id)
select 'historical_cancelled', occurrence_row.id
from public.schedule_occurrences occurrence_row
where occurrence_row.schedule_definition_id = (
  select id from schedule_lifecycle_ids where key = 'weekly_schedule'
)
  and occurrence_row.planned_local_date < current_date
order by occurrence_row.planned_local_date
limit 1;

select ok(
  (select id from schedule_lifecycle_ids where key = 'historical_cancelled') is not null,
  'weekly schedule has a historical occurrence to lock'
);

update public.schedule_occurrences occurrence_row
set lifecycle_status = 'cancelled'
where occurrence_row.id = (
  select id from schedule_lifecycle_ids where key = 'historical_cancelled'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"schedule-lifecycle@example.test"}',
  true
);

select ok(
  public.update_schedule_definition(
    (select id from schedule_lifecycle_ids where key = 'weekly_schedule'),
    'Weekly packing schedule edited',
    (select id from schedule_lifecycle_ids where key = 'packing'),
    (select id from schedule_lifecycle_ids where key = 'membership'),
    '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
    (current_date - 14),
    true
  ),
  'active schedule update persists'
);

select is(
  (
    select title
    from public.schedule_definitions
    where id = (select id from schedule_lifecycle_ids where key = 'weekly_schedule')
  ),
  'Weekly packing schedule edited',
  'updated title is stored'
);

select ok(
  (
    select count(*)
    from public.schedule_occurrences
    where schedule_definition_id = (select id from schedule_lifecycle_ids where key = 'weekly_schedule')
      and planned_local_date >= current_date
      and lifecycle_status = 'open'
  ) > 0,
  'future matching occurrences are rematerialised after edit'
);

select is(
  (
    select lifecycle_status
    from public.schedule_occurrences
    where id = (select id from schedule_lifecycle_ids where key = 'historical_cancelled')
  ),
  'cancelled',
  'historical cancelled occurrence is not rewritten by edit'
);

reset role;
set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from private.domain_event_outbox outbox_row
    where outbox_row.resource_record_id = (
      select id from schedule_lifecycle_ids where key = 'weekly_schedule'
    )
      and outbox_row.event_type = 'ScheduleUpdated'
  ),
  'update emits ScheduleUpdated'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"96000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"schedule-lifecycle@example.test"}',
  true
);

select ok(
  public.deactivate_schedule_definition(
    (select id from schedule_lifecycle_ids where key = 'once_schedule')
  ),
  'can deactivate an active schedule'
);

select throws_ok(
  format(
    $sql$
      select public.update_schedule_definition(
        %L::uuid,
        'Once packing schedule',
        %L::uuid,
        %L::uuid,
        '{"frequency":"once","interval":1}'::jsonb,
        current_date,
        true
      )
    $sql$,
    (select id from schedule_lifecycle_ids where key = 'once_schedule'),
    (select id from schedule_lifecycle_ids where key = 'packing'),
    (select id from schedule_lifecycle_ids where key = 'membership')
  ),
  '55000',
  'schedule definition is not active',
  'inactive schedule cannot be edited'
);

select ok(
  public.reactivate_schedule_definition(
    (select id from schedule_lifecycle_ids where key = 'once_schedule')
  ),
  'can reactivate an inactive schedule'
);

select is(
  (
    select status
    from public.schedule_definitions
    where id = (select id from schedule_lifecycle_ids where key = 'once_schedule')
  ),
  'active',
  'reactivated schedule is active'
);

select throws_ok(
  format(
    'select public.reactivate_schedule_definition(%L::uuid)',
    (select id from schedule_lifecycle_ids where key = 'once_schedule')
  ),
  '55000',
  'schedule definition is not inactive',
  'active schedule cannot be reactivated'
);

select ok(
  public.enqueue_due_schedule_occurrence_reminders() >= 0,
  'reminder sweep is authorised for schedule managers'
);

reset role;
set local role lean_hub_private_owner;

select is(
  (
    select count(*)
    from private.domain_event_outbox outbox_row
    where outbox_row.event_type = 'ScheduleOccurrenceReminderDue'
      and outbox_row.resource_record_id = (
        select id from schedule_lifecycle_ids where key = 'once_schedule'
      )
  ),
  1::bigint,
  'morning-of reminder is enqueued once for today''s open occurrence'
);

select lives_ok(
  format(
    'select private.enqueue_due_schedule_occurrence_reminders(%L::uuid)',
    (select id from schedule_lifecycle_ids where key = 'organisation')
  ),
  'second reminder sweep runs'
);

select is(
  (
    select count(*)
    from private.domain_event_outbox outbox_row
    where outbox_row.event_type = 'ScheduleOccurrenceReminderDue'
      and outbox_row.resource_record_id = (
        select id from schedule_lifecycle_ids where key = 'once_schedule'
      )
  ),
  1::bigint,
  'reminder sweep does not duplicate morning-of events'
);

select * from finish();
rollback;
