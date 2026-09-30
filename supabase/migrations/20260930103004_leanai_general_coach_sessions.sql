-- LEANAI-CONTEXT-04: general Coach AI sessions (ADR-0018).
-- Do not apply this migration to hosted Supabase from this change.
--
-- Extends ai_sessions with an explicit context_type so Coach conversations can
-- reuse AI runs/usage without dummy Problem Solving cases. New public APIs are
-- SECURITY INVOKER (SEC-RPC-002). Existing Problem Solving create_ai_session
-- remains unchanged.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.ai_sessions
  add column context_type text not null default 'problem_solving',
  add column module_key text,
  add column intervention_key text,
  add column site_unit_id uuid,
  add column context_contract_version text;

alter table public.ai_sessions
  alter column problem_solving_case_id drop not null;

alter table public.ai_sessions
  drop constraint ai_sessions_mode_check;

alter table public.ai_sessions
  add constraint ai_sessions_context_type_check
    check (context_type in ('problem_solving', 'coach')),
  add constraint ai_sessions_mode_check
    check (
      (
        context_type = 'problem_solving'
        and mode in ('ask', 'facilitate', 'review', 'challenge')
      )
      or (
        context_type = 'coach'
        and mode = 'ask'
      )
    ),
  add constraint ai_sessions_context_binding_check
    check (
      (
        context_type = 'problem_solving'
        and problem_solving_case_id is not null
        and module_key is null
        and intervention_key is null
        and site_unit_id is null
        and context_contract_version is null
      )
      or (
        context_type = 'coach'
        and problem_solving_case_id is null
        and problem_solving_session_id is null
        and module_key is not null
        and intervention_key is not null
        and context_contract_version is not null
      )
    ),
  add constraint ai_sessions_module_key_check
    check (
      module_key is null
      or module_key in (
        'organisation',
        'sites',
        'people',
        'maturity',
        'suggestions',
        'five_s',
        'gemba',
        'training',
        'skills',
        'recognition',
        'lean_ai',
        'problem_solving',
        'setup',
        'onboarding',
        'platform'
      )
    ),
  add constraint ai_sessions_intervention_key_check
    check (
      intervention_key is null
      or intervention_key ~ '^[a-z][a-z0-9_]{0,62}$'
    ),
  add constraint ai_sessions_context_contract_version_check
    check (
      context_contract_version is null
      or (
        context_contract_version = btrim(context_contract_version)
        and char_length(context_contract_version) between 1 and 64
      )
    ),
  add constraint ai_sessions_site_fkey
    foreign key (organisation_id, site_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict;

create index ai_sessions_coach_creator_idx
  on public.ai_sessions (
    organisation_id,
    created_by_membership_id,
    context_type,
    created_at desc
  )
  where context_type = 'coach';

create unique index ai_sessions_one_active_coach_idx
  on public.ai_sessions (
    organisation_id,
    created_by_membership_id,
    module_key,
    intervention_key,
    coalesce(site_unit_id, '00000000-0000-0000-0000-000000000000')
  )
  where context_type = 'coach' and status = 'active';

-- ---------------------------------------------------------------------------
-- Coach sessions cannot persist Problem Solving proposals
-- ---------------------------------------------------------------------------

create or replace function private.reject_coach_ai_proposals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.ai_sessions session_row
    where session_row.organisation_id = new.organisation_id
      and session_row.id = new.ai_session_id
      and session_row.context_type = 'coach'
  ) then
    raise exception 'coach sessions cannot persist problem-solving proposals'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function private.reject_coach_ai_proposals() owner to lean_hub_private_owner;

revoke all on function private.reject_coach_ai_proposals() from public, anon, authenticated;

create trigger ai_proposals_reject_coach
before insert on public.ai_proposals
for each row
execute function private.reject_coach_ai_proposals();

-- ---------------------------------------------------------------------------
-- Session read helper: Problem Solving stays case-bound; Coach is membership-bound
-- ---------------------------------------------------------------------------

create or replace function private.can_read_ai_session(
  target_organisation_id uuid,
  target_ai_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ai_sessions session_row
    where session_row.organisation_id = target_organisation_id
      and session_row.id = target_ai_session_id
      and (
        (
          session_row.context_type = 'problem_solving'
          and session_row.problem_solving_case_id is not null
          and private.can_read_problem_solving_case(
            target_organisation_id,
            session_row.problem_solving_case_id
          )
          and (
            session_row.created_by_membership_id =
              private.current_membership_id(target_organisation_id)
            or private.can_view_ai_history(target_organisation_id)
          )
        )
        or (
          session_row.context_type = 'coach'
          and session_row.problem_solving_case_id is null
          and session_row.created_by_membership_id =
            private.current_membership_id(target_organisation_id)
        )
      )
  )
$$;

alter function private.can_read_ai_session(uuid, uuid) owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- start_ai_run: case read only for Problem Solving sessions
-- ---------------------------------------------------------------------------

create or replace function private.start_ai_run(
  target_ai_session_id uuid,
  target_user_message text,
  target_idempotency_key text,
  target_provider text,
  target_model text,
  target_prompt_key text,
  target_prompt_version text,
  target_prompt_hash text
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
  session_row public.ai_sessions%rowtype;
  settings_row public.organisation_ai_settings%rowtype;
  existing_run_id uuid;
  new_run_id uuid;
  new_message_id uuid;
  monthly_usage bigint;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run start is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_use_ai(org_id) then
    raise exception 'ai is not enabled for this organisation'
      using errcode = '42501';
  end if;

  select session_table.*
  into session_row
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.id = target_ai_session_id;

  if not found then
    raise exception 'ai session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'active' then
    raise exception 'ai session is not active'
      using errcode = '55000';
  end if;

  if session_row.created_by_membership_id <> actor_membership_id then
    raise exception 'only the ai session creator may start runs'
      using errcode = '42501';
  end if;

  if session_row.context_type = 'problem_solving' then
    if session_row.problem_solving_case_id is null
      or not private.can_read_problem_solving_case(
        org_id,
        session_row.problem_solving_case_id
      ) then
      raise exception 'problem solving case access required'
        using errcode = '42501';
    end if;
  elsif session_row.context_type <> 'coach' then
    raise exception 'ai session context is not authorised'
      using errcode = '42501';
  end if;

  select settings_table.*
  into settings_row
  from public.organisation_ai_settings settings_table
  where settings_table.organisation_id = org_id;

  monthly_usage := private.organisation_ai_monthly_token_usage(org_id);
  if settings_row.monthly_token_ceiling is not null
    and monthly_usage >= settings_row.monthly_token_ceiling then
    raise exception 'organisation ai monthly token ceiling reached'
      using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.ai_runs recent_run
    where recent_run.organisation_id = org_id
      and recent_run.requested_by_membership_id = actor_membership_id
      and recent_run.started_at >= statement_timestamp() - interval '5 minutes'
  ) >= 30 then
    raise exception 'ai rate limit exceeded'
      using errcode = '42501';
  end if;

  select run_table.id
  into existing_run_id
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.idempotency_key = btrim(target_idempotency_key);

  if existing_run_id is not null then
    return existing_run_id;
  end if;

  insert into public.ai_messages (
    organisation_id,
    ai_session_id,
    role,
    content
  )
  values (
    org_id,
    target_ai_session_id,
    'user',
    btrim(target_user_message)
  )
  returning id into new_message_id;

  new_run_id := private.register_resource_record(
    org_id,
    'ai_run',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ai_runs (
    id,
    organisation_id,
    ai_session_id,
    requested_by_membership_id,
    provider,
    model,
    prompt_key,
    prompt_version,
    prompt_hash,
    status,
    idempotency_key
  )
  values (
    new_run_id,
    org_id,
    target_ai_session_id,
    actor_membership_id,
    btrim(target_provider),
    btrim(target_model),
    btrim(target_prompt_key),
    btrim(target_prompt_version),
    btrim(target_prompt_hash),
    'running',
    btrim(target_idempotency_key)
  );

  perform private.append_business_audit(
    org_id,
    'ai.run.started',
    new_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', new_run_id,
      'ai_session_id', target_ai_session_id,
      'user_message_id', new_message_id,
      'context_type', session_row.context_type
    )
  );

  return new_run_id;
end;
$$;

alter function private.start_ai_run(uuid, text, text, text, text, text, text, text)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Coach session lifecycle
-- ---------------------------------------------------------------------------

create or replace function private.create_ai_coach_session(
  target_module_key text,
  target_intervention_key text,
  target_site_unit_id uuid default null,
  target_title text default null,
  target_context_contract_version text default 'coach-session-v1'
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
  existing_session_id uuid;
  new_session_id uuid;
  normalised_module text := btrim(target_module_key);
  normalised_intervention text := btrim(target_intervention_key);
  normalised_version text := btrim(coalesce(target_context_contract_version, 'coach-session-v1'));
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_use_ai(org_id) then
    raise exception 'ai session creation is not authorised'
      using errcode = '42501';
  end if;

  if normalised_module not in (
    'organisation',
    'sites',
    'people',
    'maturity',
    'suggestions',
    'five_s',
    'gemba',
    'training',
    'skills',
    'recognition',
    'lean_ai',
    'problem_solving',
    'setup',
    'onboarding',
    'platform'
  ) then
    raise exception 'invalid coach module key'
      using errcode = '22023';
  end if;

  if normalised_intervention is null
    or normalised_intervention !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception 'invalid coach intervention key'
      using errcode = '22023';
  end if;

  if target_site_unit_id is not null
    and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_site_unit_id
        and unit_row.status = 'active'
    ) then
    raise exception 'authorised site context is required'
      using errcode = '42501';
  end if;

  select session_table.id
  into existing_session_id
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.created_by_membership_id = actor_membership_id
    and session_table.context_type = 'coach'
    and session_table.status = 'active'
    and session_table.module_key = normalised_module
    and session_table.intervention_key = normalised_intervention
    and session_table.site_unit_id is not distinct from target_site_unit_id;

  if existing_session_id is not null then
    return existing_session_id;
  end if;

  new_session_id := private.register_resource_record(
    org_id,
    'ai_session',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ai_sessions (
    id,
    organisation_id,
    problem_solving_case_id,
    problem_solving_session_id,
    created_by_membership_id,
    mode,
    status,
    title,
    context_type,
    module_key,
    intervention_key,
    site_unit_id,
    context_contract_version
  )
  values (
    new_session_id,
    org_id,
    null,
    null,
    actor_membership_id,
    'ask',
    'active',
    target_title,
    'coach',
    normalised_module,
    normalised_intervention,
    target_site_unit_id,
    normalised_version
  );

  perform private.append_business_audit(
    org_id,
    'ai.session.created',
    new_session_id,
    'succeeded',
    jsonb_build_object(
      'ai_session_id', new_session_id,
      'context_type', 'coach',
      'module_key', normalised_module,
      'intervention_key', normalised_intervention
    )
  );

  return new_session_id;
end;
$$;

create or replace function public.create_ai_coach_session(
  target_module_key text,
  target_intervention_key text,
  target_site_unit_id uuid default null,
  target_title text default null,
  target_context_contract_version text default 'coach-session-v1'
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_ai_coach_session(
    target_module_key,
    target_intervention_key,
    target_site_unit_id,
    target_title,
    target_context_contract_version
  )
$$;

alter function private.create_ai_coach_session(text, text, uuid, text, text)
  owner to lean_hub_private_owner;

revoke all on function private.create_ai_coach_session(text, text, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_ai_coach_session(text, text, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function private.create_ai_coach_session(text, text, uuid, text, text)
  to authenticated, lean_hub_private_owner;
grant execute on function public.create_ai_coach_session(text, text, uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Session detail includes Coach binding without leaking other tenants
-- ---------------------------------------------------------------------------

create or replace function public.get_ai_session_detail(target_ai_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  result jsonb;
begin
  if org_id is null
    or not private.can_read_ai_session(org_id, target_ai_session_id) then
    raise exception 'ai session read is not authorised'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', session_row.id,
      'context_type', session_row.context_type,
      'problem_solving_case_id', session_row.problem_solving_case_id,
      'problem_solving_session_id', session_row.problem_solving_session_id,
      'module_key', session_row.module_key,
      'intervention_key', session_row.intervention_key,
      'site_unit_id', session_row.site_unit_id,
      'context_contract_version', session_row.context_contract_version,
      'created_by_membership_id', session_row.created_by_membership_id,
      'mode', session_row.mode,
      'status', session_row.status,
      'title', session_row.title,
      'created_at', session_row.created_at,
      'completed_at', session_row.completed_at
    ),
    'messages', coalesce(messages_json, '[]'::jsonb),
    'proposals', coalesce(proposals_json, '[]'::jsonb)
  )
  into result
  from public.ai_sessions session_row
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', message_row.id,
        'role', message_row.role,
        'content', message_row.content,
        'ai_run_id', message_row.ai_run_id,
        'structured_payload', message_row.structured_payload,
        'created_at', message_row.created_at
      )
      order by message_row.created_at
    ) as messages_json
    from public.ai_messages message_row
    where message_row.organisation_id = org_id
      and message_row.ai_session_id = target_ai_session_id
  ) messages_lateral on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', proposal_row.id,
        'proposal_type', proposal_row.proposal_type,
        'status', proposal_row.status,
        'payload_json', proposal_row.payload_json,
        'human_explanation', proposal_row.human_explanation,
        'display_permission_key', proposal_row.display_permission_key,
        'created_at', proposal_row.created_at,
        'resolved_at', proposal_row.resolved_at
      )
      order by proposal_row.created_at
    ) as proposals_json
    from public.ai_proposals proposal_row
    where proposal_row.organisation_id = org_id
      and proposal_row.ai_session_id = target_ai_session_id
  ) proposals_lateral on true
  where session_row.organisation_id = org_id
    and session_row.id = target_ai_session_id;

  return result;
end;
$$;
