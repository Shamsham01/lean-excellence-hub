-- LEANAI-CONTEXT-01 operations: event recording, journey state, retention
-- cleanup, and deterministic organisation setup readiness.
-- No provider/model calls. Organisation IDs are derived from session context.

create or replace function private.leanai_validate_semantic_event_payload(
  target_event_key text,
  target_event_version integer,
  target_module_key text,
  target_intervention_key text,
  target_metadata jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  metadata_key text;
  metadata_value jsonb;
  metadata_key_count integer;
begin
  if target_event_key not in (
    'onboarding.started',
    'onboarding.step_completed',
    'onboarding.step_skipped',
    'onboarding.completed',
    'module.opened',
    'leanai.intervention_shown',
    'leanai.intervention_accepted',
    'leanai.intervention_dismissed',
    'leanai.intervention_snoozed'
  ) then
    raise exception 'leanai event key is not in the bounded taxonomy'
      using errcode = '23514';
  end if;

  if target_event_version is distinct from 1 then
    raise exception 'leanai event version is not supported'
      using errcode = '23514';
  end if;

  if target_event_key = 'module.opened' and target_module_key is null then
    raise exception 'module.opened requires a bounded module key'
      using errcode = '23514';
  end if;

  if target_event_key like 'leanai.intervention_%' and target_intervention_key is null then
    raise exception 'intervention events require an intervention key'
      using errcode = '23514';
  end if;

  if target_intervention_key is not null
    and target_intervention_key !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception 'leanai intervention key is not a bounded identifier'
      using errcode = '23514';
  end if;

  if target_metadata is null or jsonb_typeof(target_metadata) <> 'object' then
    raise exception 'leanai event metadata must be a json object'
      using errcode = '23514';
  end if;

  if pg_catalog.pg_column_size(target_metadata) > 2048 then
    raise exception 'leanai event metadata is too large'
      using errcode = '23514';
  end if;

  select count(*)
  into metadata_key_count
  from jsonb_object_keys(target_metadata);

  if metadata_key_count > 16 then
    raise exception 'leanai event metadata has too many keys'
      using errcode = '23514';
  end if;

  for metadata_key, metadata_value in
    select key, value
    from jsonb_each(target_metadata)
  loop
    if metadata_key !~ '^[a-z][a-z0-9_]{0,62}$' then
      raise exception 'leanai event metadata keys must be bounded identifiers'
        using errcode = '23514';
    end if;

    if metadata_key in (
      'mouse', 'hover', 'keystroke', 'keystrokes', 'click', 'clicks',
      'coordinates', 'x', 'y', 'dwell_ms', 'dwell', 'password', 'secret',
      'token', 'api_key', 'content', 'body', 'transcript', 'deleted_text'
    ) then
      raise exception 'leanai event metadata must not record surveillance or secret fields'
        using errcode = '23514';
    end if;

    if jsonb_typeof(metadata_value) not in ('string', 'number', 'boolean', 'null') then
      raise exception 'leanai event metadata values must be scalar'
        using errcode = '23514';
    end if;

    if jsonb_typeof(metadata_value) = 'string'
      and char_length(metadata_value #>> '{}') > 200 then
      raise exception 'leanai event metadata strings must stay within the bounded length'
        using errcode = '23514';
    end if;
  end loop;

  if target_event_key in ('onboarding.step_completed', 'onboarding.step_skipped')
    and coalesce(target_metadata ->> 'step_key', '') !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception 'onboarding step events require a bounded step_key'
      using errcode = '23514';
  end if;

  if target_event_key = 'leanai.intervention_snoozed'
    and (
      jsonb_typeof(target_metadata -> 'snooze_minutes') <> 'number'
      or trunc((target_metadata ->> 'snooze_minutes')::numeric) <> (target_metadata ->> 'snooze_minutes')::numeric
      or (target_metadata ->> 'snooze_minutes')::integer < 15
      or (target_metadata ->> 'snooze_minutes')::integer > 10080
    ) then
    raise exception 'snooze events require snooze_minutes within the allowed window'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.leanai_upsert_journey_from_event(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_event_key text,
  target_module_key text,
  target_intervention_key text,
  target_metadata jsonb,
  target_occurred_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  next_onboarding_status text;
  snooze_until timestamptz;
begin
  insert into public.leanai_journey_contexts (
    organisation_id,
    membership_id,
    updated_at
  )
  values (
    target_organisation_id,
    target_membership_id,
    statement_timestamp()
  )
  on conflict (organisation_id, membership_id) do nothing;

  if target_event_key = 'module.opened' then
    update public.leanai_journey_contexts
    set recent_module_key = target_module_key,
        recent_module_opened_at = target_occurred_at,
        updated_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and membership_id = target_membership_id;
  end if;

  if target_event_key like 'onboarding.%' then
    next_onboarding_status := case target_event_key
      when 'onboarding.completed' then 'completed'
      else 'in_progress'
    end;

    update public.leanai_journey_contexts
    set onboarding_status = next_onboarding_status,
        last_onboarding_step_key = coalesce(target_metadata ->> 'step_key', last_onboarding_step_key),
        last_onboarding_event_key = target_event_key,
        last_onboarding_at = target_occurred_at,
        updated_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and membership_id = target_membership_id;
  end if;

  if target_event_key like 'leanai.intervention_%' then
    update public.leanai_journey_contexts
    set last_intervention_key = target_intervention_key,
        last_intervention_event_key = target_event_key,
        last_intervention_at = target_occurred_at,
        updated_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and membership_id = target_membership_id;

    snooze_until := case
      when target_event_key = 'leanai.intervention_snoozed'
        then target_occurred_at + make_interval(mins := (target_metadata ->> 'snooze_minutes')::integer)
      else null
    end;

    insert into public.leanai_intervention_states (
      organisation_id,
      membership_id,
      intervention_key,
      last_event_key,
      last_shown_at,
      last_accepted_at,
      last_dismissed_at,
      snoozed_until,
      updated_at
    )
    values (
      target_organisation_id,
      target_membership_id,
      target_intervention_key,
      target_event_key,
      case when target_event_key = 'leanai.intervention_shown' then target_occurred_at else null end,
      case when target_event_key = 'leanai.intervention_accepted' then target_occurred_at else null end,
      case when target_event_key = 'leanai.intervention_dismissed' then target_occurred_at else null end,
      snooze_until,
      statement_timestamp()
    )
    on conflict (organisation_id, membership_id, intervention_key)
    do update set
      last_event_key = excluded.last_event_key,
      last_shown_at = coalesce(excluded.last_shown_at, public.leanai_intervention_states.last_shown_at),
      last_accepted_at = coalesce(excluded.last_accepted_at, public.leanai_intervention_states.last_accepted_at),
      last_dismissed_at = coalesce(excluded.last_dismissed_at, public.leanai_intervention_states.last_dismissed_at),
      snoozed_until = case
        when excluded.last_event_key = 'leanai.intervention_snoozed' then excluded.snoozed_until
        when excluded.last_event_key in (
          'leanai.intervention_accepted',
          'leanai.intervention_dismissed'
        ) then null
        else public.leanai_intervention_states.snoozed_until
      end,
      updated_at = statement_timestamp();
  end if;
end;
$$;

create or replace function private.record_leanai_semantic_event(
  target_event_key text,
  target_event_version integer default 1,
  target_module_key text default null,
  target_intervention_key text default null,
  target_site_unit_id uuid default null,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default null
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
  occurred_at timestamptz := coalesce(target_occurred_at, statement_timestamp());
  recent_event_count integer;
  new_event_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'leanai semantic event recording is not authorised'
      using errcode = '42501';
  end if;

  perform private.leanai_validate_semantic_event_payload(
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    coalesce(target_metadata, '{}'::jsonb)
  );

  if occurred_at > statement_timestamp() + interval '5 minutes' then
    raise exception 'leanai event occurred_at cannot be in the future'
      using errcode = '23514';
  end if;

  if target_site_unit_id is not null and not exists (
    select 1
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = target_site_unit_id
  ) then
    raise exception 'leanai event site is not in the current organisation'
      using errcode = '42501';
  end if;

  select count(*)
  into recent_event_count
  from public.leanai_semantic_events event_row
  where event_row.organisation_id = org_id
    and event_row.membership_id = actor_membership_id
    and event_row.created_at > statement_timestamp() - interval '5 minutes';

  if recent_event_count >= 60 then
    raise exception 'leanai semantic event rate limit exceeded'
      using errcode = '54000';
  end if;

  insert into public.leanai_semantic_events (
    organisation_id,
    membership_id,
    event_key,
    event_version,
    module_key,
    intervention_key,
    site_unit_id,
    metadata,
    occurred_at
  )
  values (
    org_id,
    actor_membership_id,
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    target_site_unit_id,
    coalesce(target_metadata, '{}'::jsonb),
    occurred_at
  )
  returning id into new_event_id;

  perform private.leanai_upsert_journey_from_event(
    org_id,
    actor_membership_id,
    target_event_key,
    target_module_key,
    target_intervention_key,
    coalesce(target_metadata, '{}'::jsonb),
    occurred_at
  );

  return new_event_id;
end;
$$;

create or replace function private.leanai_event_retention_days(
  target_organisation_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select settings_row.journey_event_retention_days
      from public.organisation_ai_settings settings_row
      where settings_row.organisation_id = target_organisation_id
    ),
    90
  );
$$;

create or replace function private.cleanup_expired_leanai_semantic_events(
  target_organisation_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  -- Safe cleanup path for later scheduled retention. This slice does not
  -- schedule automatic deletion. Intervention current-state rows are kept.
  with deleted as (
    delete from public.leanai_semantic_events event_row
    where (target_organisation_id is null or event_row.organisation_id = target_organisation_id)
      and event_row.occurred_at < statement_timestamp() - make_interval(
        days := private.leanai_event_retention_days(event_row.organisation_id)
      )
    returning event_row.id
  )
  select count(*)::integer into deleted_count from deleted;

  return deleted_count;
end;
$$;

create or replace function private.get_leanai_journey_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  context_row public.leanai_journey_contexts%rowtype;
  intervention_json jsonb;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'leanai journey context is not authorised'
      using errcode = '42501';
  end if;

  select context_table.*
  into context_row
  from public.leanai_journey_contexts context_table
  where context_table.organisation_id = org_id
    and context_table.membership_id = actor_membership_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'intervention_key', state_row.intervention_key,
        'last_event_key', state_row.last_event_key,
        'last_shown_at', state_row.last_shown_at,
        'last_accepted_at', state_row.last_accepted_at,
        'last_dismissed_at', state_row.last_dismissed_at,
        'snoozed_until', state_row.snoozed_until
      )
      order by state_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into intervention_json
  from public.leanai_intervention_states state_row
  where state_row.organisation_id = org_id
    and state_row.membership_id = actor_membership_id;

  return jsonb_build_object(
    'organisation_id', org_id,
    'membership_id', actor_membership_id,
    'recent_module_key', context_row.recent_module_key,
    'recent_module_opened_at', context_row.recent_module_opened_at,
    'onboarding_status', coalesce(context_row.onboarding_status, 'not_started'),
    'last_onboarding_step_key', context_row.last_onboarding_step_key,
    'last_onboarding_event_key', context_row.last_onboarding_event_key,
    'last_onboarding_at', context_row.last_onboarding_at,
    'last_intervention_key', context_row.last_intervention_key,
    'last_intervention_event_key', context_row.last_intervention_event_key,
    'last_intervention_at', context_row.last_intervention_at,
    'intervention_states', intervention_json
  );
end;
$$;
