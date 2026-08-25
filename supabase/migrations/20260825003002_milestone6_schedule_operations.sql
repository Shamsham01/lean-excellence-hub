-- Schedule timezone, recurrence, occurrence helpers and authoritative RPCs.

create or replace function private.is_valid_schedule_timezone(
  target_timezone text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names zone_name
    where zone_name.name = target_timezone
  )
$$;

create or replace function private.schedule_local_to_timestamptz(
  target_local_date date,
  target_local_time time,
  target_is_all_day boolean,
  target_timezone text
)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if target_is_all_day then
    return (target_local_date::timestamp without time zone at time zone target_timezone);
  end if;

  return (
    (target_local_date + target_local_time)::timestamp without time zone
    at time zone target_timezone
  );
end;
$$;

create or replace function private.schedule_end_of_local_date(
  target_local_date date,
  target_timezone text
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((target_local_date + 1)::timestamp without time zone at time zone target_timezone)
$$;

create or replace function private.schedule_last_day_of_month(
  target_year integer,
  target_month integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select (
    make_date(target_year, target_month, 1)
    + interval '1 month - 1 day'
  )::date
$$;

create or replace function private.schedule_monthly_occurrence_date(
  target_year integer,
  target_month integer,
  target_monthly_day integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  month_last_day date;
begin
  month_last_day := private.schedule_last_day_of_month(target_year, target_month);

  if target_monthly_day = 31 then
    return month_last_day;
  end if;

  return make_date(
    target_year,
    target_month,
    least(target_monthly_day, extract(day from month_last_day)::integer)
  );
end;
$$;

create or replace function private.derive_schedule_occurrence_status(
  target_lifecycle_status text,
  target_planned_local_date date,
  target_timezone text,
  target_now timestamptz default statement_timestamp()
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  end_of_local_day timestamptz;
begin
  if target_lifecycle_status = 'completed' then
    return 'completed';
  end if;

  if target_lifecycle_status = 'cancelled' then
    return 'cancelled';
  end if;

  end_of_local_day := private.schedule_end_of_local_date(
    target_planned_local_date,
    target_timezone
  );

  if target_now >= end_of_local_day then
    return 'missed';
  end if;

  if target_now >= private.schedule_local_to_timestamptz(
    target_planned_local_date,
    '00:00:00'::time,
    true,
    target_timezone
  ) then
    return 'due';
  end if;

  return 'scheduled';
end;
$$;

create or replace function private.is_schedule_self_participant(
  target_organisation_id uuid,
  target_schedule_definition_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = target_organisation_id
      and schedule_row.id = target_schedule_definition_id
      and schedule_row.owner_membership_id = target_membership_id
  )
  or exists (
    select 1
    from public.schedule_participants participant_row
    where participant_row.organisation_id = target_organisation_id
      and participant_row.schedule_definition_id = target_schedule_definition_id
      and participant_row.membership_id = target_membership_id
  )
$$;

create or replace function private.validate_schedule_recurrence(
  target_recurrence jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  frequency text;
  interval_value integer;
  weekday_item text;
begin
  if target_recurrence is null
    or pg_catalog.jsonb_typeof(target_recurrence) <> 'object' then
    return false;
  end if;

  frequency := target_recurrence ->> 'frequency';

  if frequency not in ('once', 'daily', 'weekly', 'monthly') then
    return false;
  end if;

  interval_value := coalesce((target_recurrence ->> 'interval')::integer, 1);
  if interval_value < 1 or interval_value > 365 then
    return false;
  end if;

  if frequency = 'weekly' then
    if pg_catalog.jsonb_typeof(target_recurrence -> 'weekdays') <> 'array'
      or jsonb_array_length(target_recurrence -> 'weekdays') = 0 then
      return false;
    end if;

    for weekday_item in
      select jsonb_array_elements_text(target_recurrence -> 'weekdays')
    loop
      if weekday_item not in (
        'monday', 'tuesday', 'wednesday', 'thursday',
        'friday', 'saturday', 'sunday'
      ) then
        return false;
      end if;
    end loop;
  end if;

  if frequency = 'monthly' then
    if (target_recurrence ->> 'monthly_day') is null
      or (target_recurrence ->> 'monthly_day')::integer < 1
      or (target_recurrence ->> 'monthly_day')::integer > 31 then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function private.schedule_weekday_matches(
  target_local_date date,
  target_weekday text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case target_weekday
    when 'monday' then extract(isodow from target_local_date) = 1
    when 'tuesday' then extract(isodow from target_local_date) = 2
    when 'wednesday' then extract(isodow from target_local_date) = 3
    when 'thursday' then extract(isodow from target_local_date) = 4
    when 'friday' then extract(isodow from target_local_date) = 5
    when 'saturday' then extract(isodow from target_local_date) = 6
    when 'sunday' then extract(isodow from target_local_date) = 7
    else false
  end
$$;

create or replace function private.schedule_activity_resource_type(
  target_organisation_id uuid,
  target_activity_resource_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select resource_registry.resource_type
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_activity_resource_id
    and resource_registry.retired_at is null
$$;

create or replace function private.is_schedule_activity_resource_type(
  target_resource_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_resource_type in ('five_s_standard', 'gemba_definition')
$$;

create or replace function private.can_reference_schedule_activity_resource(
  target_organisation_id uuid,
  target_activity_resource_id uuid,
  target_unit_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_type text;
begin
  resource_type := private.schedule_activity_resource_type(
    target_organisation_id,
    target_activity_resource_id
  );

  if not private.is_schedule_activity_resource_type(resource_type) then
    return false;
  end if;

  if resource_type = 'five_s_standard' then
    return private.has_scoped_permission(
      target_organisation_id,
      'five_s.read',
      null,
      target_unit_id
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'five_s.read',
      null,
      null
    );
  end if;

  return private.has_scoped_permission(
    target_organisation_id,
    'gemba.read',
    null,
    target_unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'gemba.read',
    null,
    null
  );
end;
$$;

create or replace function private.can_read_schedule_definition(
  target_organisation_id uuid,
  target_schedule_definition_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  schedule_row public.schedule_definitions%rowtype;
  actor_membership_id uuid := private.current_membership_id(target_organisation_id);
begin
  select schedule_item.*
  into schedule_row
  from public.schedule_definitions schedule_item
  where schedule_item.organisation_id = target_organisation_id
    and schedule_item.id = target_schedule_definition_id;

  if not found or actor_membership_id is null then
    return false;
  end if;

  return private.has_scoped_permission(
    target_organisation_id,
    'schedules.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'schedules.read',
    null,
    schedule_row.unit_id
  )
  or (
    private.has_scoped_permission(
      target_organisation_id,
      'schedules.read',
      schedule_row.owner_membership_id,
      null
    )
    and actor_membership_id = schedule_row.owner_membership_id
  )
  or (
    private.has_scoped_permission(
      target_organisation_id,
      'schedules.read',
      actor_membership_id,
      null
    )
    and private.is_schedule_self_participant(
      target_organisation_id,
      target_schedule_definition_id,
      actor_membership_id
    )
  );
end;
$$;

create or replace function private.can_manage_schedule_definition(
  target_organisation_id uuid,
  target_schedule_definition_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  schedule_row public.schedule_definitions%rowtype;
  actor_membership_id uuid := private.current_membership_id(target_organisation_id);
begin
  if target_schedule_definition_id is not null then
    select schedule_item.*
    into schedule_row
    from public.schedule_definitions schedule_item
    where schedule_item.organisation_id = target_organisation_id
      and schedule_item.id = target_schedule_definition_id;

    if not found then
      return false;
    end if;
  end if;

  if actor_membership_id is null then
    return false;
  end if;

  if target_schedule_definition_id is null then
    return private.has_scoped_permission(
      target_organisation_id,
      'schedules.manage',
      null,
      null
    );
  end if;

  return (
    private.has_scoped_permission(
      target_organisation_id,
      'schedules.manage',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'schedules.manage',
      null,
      schedule_row.unit_id
    )
    or (
      private.has_scoped_permission(
        target_organisation_id,
        'schedules.manage',
        schedule_row.owner_membership_id,
        null
      )
      and actor_membership_id = schedule_row.owner_membership_id
    )
    or (
      private.has_scoped_permission(
        target_organisation_id,
        'schedules.manage',
        actor_membership_id,
        null
      )
      and private.is_schedule_self_participant(
        target_organisation_id,
        target_schedule_definition_id,
        actor_membership_id
      )
    )
  );
end;
$$;

create or replace function private.can_read_schedule_occurrence(
  target_organisation_id uuid,
  target_occurrence_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_occurrences occurrence_row
    where occurrence_row.organisation_id = target_organisation_id
      and occurrence_row.id = target_occurrence_id
      and private.can_read_schedule_definition(
        target_organisation_id,
        occurrence_row.schedule_definition_id
      )
  )
$$;

create or replace function private.schedule_recurrence_matches_date(
  target_recurrence jsonb,
  target_start_date date,
  target_end_date date,
  target_local_date date
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  frequency text;
  interval_value integer;
  weeks_since_start integer;
  weekday_item text;
  monthly_day integer;
begin
  if target_local_date < target_start_date then
    return false;
  end if;

  if target_end_date is not null and target_local_date > target_end_date then
    return false;
  end if;

  frequency := target_recurrence ->> 'frequency';
  interval_value := coalesce((target_recurrence ->> 'interval')::integer, 1);

  if frequency = 'once' then
    return target_local_date = target_start_date;
  end if;

  if frequency = 'daily' then
    return (target_local_date - target_start_date) % interval_value = 0;
  end if;

  if frequency = 'weekly' then
    weeks_since_start := (target_local_date - target_start_date) / 7;
    if weeks_since_start % interval_value <> 0 then
      return false;
    end if;

    for weekday_item in
      select jsonb_array_elements_text(target_recurrence -> 'weekdays')
    loop
      if private.schedule_weekday_matches(target_local_date, weekday_item) then
        return true;
      end if;
    end loop;

    return false;
  end if;

  if frequency = 'monthly' then
    monthly_day := (target_recurrence ->> 'monthly_day')::integer;
  return target_local_date = private.schedule_monthly_occurrence_date(
      extract(year from target_local_date)::integer,
      extract(month from target_local_date)::integer,
      monthly_day
    )
    and (
      (
        extract(year from age(target_local_date, target_start_date)) * 12
        + extract(month from age(target_local_date, target_start_date))
      ) % interval_value = 0
    );
  end if;

  return false;
end;
$$;

create or replace function private.ensure_schedule_occurrences(
  target_schedule_definition_id uuid,
  target_horizon_days integer default 90
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_row public.schedule_definitions%rowtype;
  horizon_end_date date;
  cursor_date date;
  inserted_count integer := 0;
  planned_at_value timestamptz;
begin
  select schedule_item.*
  into schedule_row
  from public.schedule_definitions schedule_item
  where schedule_item.organisation_id = org_id
    and schedule_item.id = target_schedule_definition_id
  for update;

  if not found then
    raise exception 'schedule definition was not found'
      using errcode = '23503';
  end if;

  if schedule_row.status <> 'active' then
    return 0;
  end if;

  horizon_end_date := (
    timezone(schedule_row.timezone, statement_timestamp())::date
    + target_horizon_days
  );

  cursor_date := schedule_row.start_date;

  while cursor_date <= horizon_end_date loop
    if private.schedule_recurrence_matches_date(
      schedule_row.recurrence,
      schedule_row.start_date,
      schedule_row.end_date,
      cursor_date
    ) then
      planned_at_value := private.schedule_local_to_timestamptz(
        cursor_date,
        schedule_row.local_time,
        schedule_row.is_all_day,
        schedule_row.timezone
      );

      insert into public.schedule_occurrences (
        organisation_id,
        schedule_definition_id,
        planned_local_date,
        is_all_day,
        local_time,
        planned_at,
        unit_id,
        owner_membership_id,
        lifecycle_status
      )
      values (
        org_id,
        schedule_row.id,
        cursor_date,
        schedule_row.is_all_day,
        schedule_row.local_time,
        planned_at_value,
        schedule_row.unit_id,
        schedule_row.owner_membership_id,
        'open'
      )
      on conflict do nothing;

      if found then
        inserted_count := inserted_count + 1;
      end if;
    end if;

    cursor_date := cursor_date + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function private.create_schedule_definition(
  target_activity_resource_id uuid,
  target_title text,
  target_unit_id uuid,
  target_owner_membership_id uuid,
  target_recurrence jsonb,
  target_start_date date,
  target_is_all_day boolean default false,
  target_local_time time default null,
  target_end_date date default null,
  target_description text default null,
  target_participant_membership_ids uuid[] default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  organisation_timezone text;
  new_schedule_id uuid;
  participant_id uuid;
  activity_type text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_schedule_definition(org_id, null) then
    raise exception 'schedule creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.validate_schedule_recurrence(target_recurrence) then
    raise exception 'schedule recurrence is invalid'
      using errcode = '22023';
  end if;

  if target_is_all_day and target_local_time is not null then
    raise exception 'all-day schedules cannot include local time'
      using errcode = '22023';
  end if;

  if not target_is_all_day and target_local_time is null then
    raise exception 'timed schedules require local time'
      using errcode = '22023';
  end if;

  activity_type := private.schedule_activity_resource_type(
    org_id,
    target_activity_resource_id
  );

  if not private.is_schedule_activity_resource_type(activity_type) then
    raise exception 'schedule activity resource type is invalid'
      using errcode = '22023';
  end if;

  if not private.can_reference_schedule_activity_resource(
    org_id,
    target_activity_resource_id,
    target_unit_id
  ) then
    raise exception 'schedule activity resource is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = target_owner_membership_id
      and membership_row.status = 'active'
  ) then
    raise exception 'schedule owner membership is invalid'
      using errcode = '23503';
  end if;

  select organisation.time_zone
  into organisation_timezone
  from public.organisations organisation
  where organisation.id = org_id;

  if not private.is_valid_schedule_timezone(organisation_timezone) then
    organisation_timezone := 'UTC';
  end if;

  new_schedule_id := private.register_resource_record(
    org_id,
    'schedule_definition',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.schedule_definitions (
    id,
    organisation_id,
    activity_resource_id,
    title,
    description,
    unit_id,
    owner_membership_id,
    timezone,
    is_all_day,
    local_time,
    recurrence,
    start_date,
    end_date,
    status,
    version_number,
    created_by_membership_id
  )
  values (
    new_schedule_id,
    org_id,
    target_activity_resource_id,
    target_title,
    target_description,
    target_unit_id,
    target_owner_membership_id,
    organisation_timezone,
    target_is_all_day,
    target_local_time,
    target_recurrence,
    target_start_date,
    target_end_date,
    'active',
    1,
    actor_membership_id
  );

  if target_participant_membership_ids is not null then
    foreach participant_id in array target_participant_membership_ids
    loop
      if not exists (
        select 1
        from public.organisation_memberships membership_row
        where membership_row.organisation_id = org_id
          and membership_row.id = participant_id
          and membership_row.status = 'active'
      ) then
        raise exception 'schedule participant membership is invalid'
          using errcode = '23503';
      end if;

      insert into public.schedule_participants (
        organisation_id,
        schedule_definition_id,
        membership_id
      )
      values (org_id, new_schedule_id, participant_id)
      on conflict do nothing;
    end loop;
  end if;

  perform private.ensure_schedule_occurrences(new_schedule_id);

  perform private.append_business_audit(
    org_id,
    'schedule.created',
    new_schedule_id,
    'succeeded',
    jsonb_build_object(
      'activity_resource_id', target_activity_resource_id,
      'activity_resource_type', activity_type
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_schedule_id,
    'ScheduleCreated',
    new_schedule_id::text,
    jsonb_build_object('schedule_definition_id', new_schedule_id)
  );

  return new_schedule_id;
end;
$$;

create or replace function private.deactivate_schedule_definition(
  target_schedule_definition_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_timezone text;
begin
  if org_id is null
    or not private.can_manage_schedule_definition(org_id, target_schedule_definition_id) then
    raise exception 'schedule deactivation is not authorised'
      using errcode = '42501';
  end if;

  update public.schedule_definitions schedule_row
  set status = 'inactive',
      version_number = schedule_row.version_number + 1
  where schedule_row.organisation_id = org_id
    and schedule_row.id = target_schedule_definition_id
    and schedule_row.status = 'active';

  if not found then
    raise exception 'schedule definition is not active'
      using errcode = '55000';
  end if;

  select schedule_row.timezone
  into schedule_timezone
  from public.schedule_definitions schedule_row
  where schedule_row.organisation_id = org_id
    and schedule_row.id = target_schedule_definition_id;

  update public.schedule_occurrences occurrence_row
  set lifecycle_status = 'cancelled'
  where occurrence_row.organisation_id = org_id
    and occurrence_row.schedule_definition_id = target_schedule_definition_id
    and occurrence_row.lifecycle_status = 'open'
    and occurrence_row.planned_local_date >= timezone(schedule_timezone, statement_timestamp())::date;

  perform private.append_business_audit(
    org_id,
    'schedule.deactivated',
    target_schedule_definition_id,
    'succeeded',
    jsonb_build_object('schedule_definition_id', target_schedule_definition_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_schedule_definition_id,
    'ScheduleUpdated',
    target_schedule_definition_id::text,
    jsonb_build_object('status', 'inactive')
  );

  return true;
end;
$$;

create or replace function private.complete_schedule_occurrence(
  target_occurrence_id uuid,
  target_completion_resource_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  occurrence_row public.schedule_occurrences%rowtype;
  completion_type text;
  schedule_activity_type text;
begin
  select occurrence_item.*
  into occurrence_row
  from public.schedule_occurrences occurrence_item
  where occurrence_item.organisation_id = org_id
    and occurrence_item.id = target_occurrence_id
    and occurrence_item.lifecycle_status = 'open'
  for update;

  if not found then
    raise exception 'schedule occurrence is not completable'
      using errcode = '55000';
  end if;

  if not private.can_read_schedule_occurrence(org_id, target_occurrence_id) then
    raise exception 'schedule occurrence completion is not authorised'
      using errcode = '42501';
  end if;

  completion_type := private.schedule_activity_resource_type(
    org_id,
    target_completion_resource_id
  );

  if completion_type not in ('five_s_audit', 'gemba_walk') then
    raise exception 'completion resource type is invalid'
      using errcode = '22023';
  end if;

  select private.schedule_activity_resource_type(
    org_id,
    schedule_row.activity_resource_id
  )
  into schedule_activity_type
  from public.schedule_definitions schedule_row
  where schedule_row.organisation_id = org_id
    and schedule_row.id = occurrence_row.schedule_definition_id;

  if schedule_activity_type = 'five_s_standard' and completion_type <> 'five_s_audit' then
    raise exception 'completion resource does not match schedule activity'
      using errcode = '22023';
  end if;

  if schedule_activity_type = 'gemba_definition' and completion_type <> 'gemba_walk' then
    raise exception 'completion resource does not match schedule activity'
      using errcode = '22023';
  end if;

  update public.schedule_occurrences
  set lifecycle_status = 'completed',
      completion_resource_id = target_completion_resource_id,
      completed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_occurrence_id;

  return true;
end;
$$;

create policy schedule_definitions_select
on public.schedule_definitions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_schedule_definition(organisation_id, id)
);

create policy schedule_participants_select
on public.schedule_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_schedule_definition(organisation_id, schedule_definition_id)
);

create policy schedule_occurrences_select
on public.schedule_occurrences for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_schedule_occurrence(organisation_id, id)
);

grant select on public.schedule_definitions to authenticated;
grant select on public.schedule_participants to authenticated;
grant select on public.schedule_occurrences to authenticated;

create or replace function public.create_schedule_definition(
  target_activity_resource_id uuid,
  target_title text,
  target_unit_id uuid,
  target_owner_membership_id uuid,
  target_recurrence jsonb,
  target_start_date date,
  target_is_all_day boolean default false,
  target_local_time time default null,
  target_end_date date default null,
  target_description text default null,
  target_participant_membership_ids uuid[] default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_schedule_definition(
    target_activity_resource_id,
    target_title,
    target_unit_id,
    target_owner_membership_id,
    target_recurrence,
    target_start_date,
    target_is_all_day,
    target_local_time,
    target_end_date,
    target_description,
    target_participant_membership_ids
  )
$$;

create or replace function public.deactivate_schedule_definition(
  target_schedule_definition_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.deactivate_schedule_definition(target_schedule_definition_id)
$$;

create or replace function public.ensure_schedule_occurrences(
  target_schedule_definition_id uuid,
  target_horizon_days integer default 90
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.ensure_schedule_occurrences(
    target_schedule_definition_id,
    target_horizon_days
  )
$$;

create or replace function public.derive_schedule_occurrence_status(
  target_lifecycle_status text,
  target_planned_local_date date,
  target_timezone text,
  target_now timestamptz default statement_timestamp()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.derive_schedule_occurrence_status(
    target_lifecycle_status,
    target_planned_local_date,
    target_timezone,
    target_now
  )
$$;

grant execute on function public.create_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) to authenticated;
grant execute on function public.deactivate_schedule_definition(uuid) to authenticated;
grant execute on function public.ensure_schedule_occurrences(uuid, integer) to authenticated;
grant execute on function public.derive_schedule_occurrence_status(
  text, date, text, timestamptz
) to authenticated;

alter function private.is_valid_schedule_timezone(text)
  owner to lean_hub_private_owner;
alter function private.schedule_local_to_timestamptz(date, time, boolean, text)
  owner to lean_hub_private_owner;
alter function private.schedule_end_of_local_date(date, text)
  owner to lean_hub_private_owner;
alter function private.schedule_last_day_of_month(integer, integer)
  owner to lean_hub_private_owner;
alter function private.schedule_monthly_occurrence_date(integer, integer, integer)
  owner to lean_hub_private_owner;
alter function private.derive_schedule_occurrence_status(text, date, text, timestamptz)
  owner to lean_hub_private_owner;
alter function private.is_schedule_self_participant(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.validate_schedule_recurrence(jsonb)
  owner to lean_hub_private_owner;
alter function private.can_read_schedule_definition(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_manage_schedule_definition(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_read_schedule_occurrence(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.ensure_schedule_occurrences(uuid, integer)
  owner to lean_hub_private_owner;
alter function private.create_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) owner to lean_hub_private_owner;
alter function private.deactivate_schedule_definition(uuid)
  owner to lean_hub_private_owner;
alter function private.complete_schedule_occurrence(uuid, uuid)
  owner to lean_hub_private_owner;

revoke all on function public.create_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) from public, anon;
revoke all on function public.deactivate_schedule_definition(uuid) from public, anon;
revoke all on function public.ensure_schedule_occurrences(uuid, integer) from public, anon;
revoke all on function public.derive_schedule_occurrence_status(
  text, date, text, timestamptz
) from public, anon;
