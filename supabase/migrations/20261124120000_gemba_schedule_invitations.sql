-- Keep the worker tick and other notification projectors intact.
create or replace function private.enqueue_due_schedule_occurrence_reminders(target_organisation_id uuid default null)
returns integer language sql immutable security invoker set search_path = '' as $$ select 0 $$;
revoke execute on function private.enqueue_due_schedule_occurrence_reminders(uuid) from public, anon;

create function private.schedule_calendar_state(s public.schedule_definitions)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('start_date', s.start_date, 'end_date', s.end_date,
    'local_time', s.local_time, 'all_day', s.is_all_day, 'timezone', s.timezone,
    'recurrence', s.recurrence, 'owner', s.owner_membership_id,
    'participants', coalesce((select jsonb_agg(p.membership_id order by p.membership_id)
      from public.schedule_participants p where p.schedule_definition_id = s.id
      and p.organisation_id = s.organisation_id), '[]'::jsonb))
$$;
revoke execute on function private.schedule_calendar_state(public.schedule_definitions) from public, anon;
grant execute on function private.schedule_calendar_state(public.schedule_definitions) to lean_hub_private_owner;

alter table public.schedule_definitions add column calendar_state jsonb;
update public.schedule_definitions s set calendar_state = private.schedule_calendar_state(s);

-- Schedule mutation RPCs enqueue these events after replacing participants.
create function private.enqueue_schedule_calendar_confirmation()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  s public.schedule_definitions%rowtype;
  snapshot jsonb;
  first_date date;
begin
  select * into strict s from public.schedule_definitions
    where id = new.resource_record_id and organisation_id = new.organisation_id for update;
  snapshot := private.schedule_calendar_state(s);
  if s.status <> 'active' or snapshot = s.calendar_state then return new; end if;
  update public.schedule_definitions set calendar_state = snapshot where id = s.id;
  select min(planned_local_date) into first_date from public.schedule_occurrences
    where schedule_definition_id = s.id and lifecycle_status <> 'cancelled'
      and planned_local_date >= s.start_date and private.schedule_recurrence_matches_date(
        s.recurrence, s.start_date, s.end_date, planned_local_date);
  if first_date is null then
    select min(s.start_date + i) into first_date from generate_series(0, 366) i
    where private.schedule_recurrence_matches_date(s.recurrence, s.start_date, s.end_date, s.start_date + i);
  end if;
  if first_date is null then return new; end if;
  perform private.enqueue_domain_event(s.organisation_id, s.id, 'ScheduleCalendarConfirmed',
    'schedule-calendar:' || s.id || ':' || s.version_number,
    snapshot || jsonb_build_object('id', s.id, 'title', s.title, 'description', s.description,
      'first_date', first_date, 'sequence', s.version_number, 'stamp', new.created_at,
      'until_utc', to_char(((s.end_date + time '23:59:59') at time zone s.timezone) at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"'),
      'context_title', s.title, 'context_link_path', '/platform/schedule/' || s.id));
  return new;
end;
$$;
revoke execute on function private.enqueue_schedule_calendar_confirmation() from public, anon;
create trigger schedule_calendar_confirmation after insert on private.domain_event_outbox
for each row when (new.event_type in ('ScheduleCreated', 'ScheduleUpdated'))
execute function private.enqueue_schedule_calendar_confirmation();
