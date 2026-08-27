-- Milestone 12: AI authoritative operations (sessions, runs, settings, reject).

create or replace function private.create_ai_session(
  target_problem_solving_case_id uuid,
  target_mode text,
  target_problem_solving_session_id uuid default null,
  target_title text default null
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
  new_session_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_use_ai(org_id)
    or not private.can_read_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'ai session creation is not authorised'
      using errcode = '42501';
  end if;

  if target_mode not in ('ask', 'facilitate', 'review', 'challenge') then
    raise exception 'invalid ai session mode'
      using errcode = '22023';
  end if;

  if target_problem_solving_session_id is not null then
    if not exists (
      select 1
      from public.problem_solving_sessions ps_session
      where ps_session.organisation_id = org_id
        and ps_session.id = target_problem_solving_session_id
        and ps_session.case_id = target_problem_solving_case_id
    ) then
      raise exception 'problem solving session not found for case'
        using errcode = 'P0002';
    end if;
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
    title
  )
  values (
    new_session_id,
    org_id,
    target_problem_solving_case_id,
    target_problem_solving_session_id,
    actor_membership_id,
    target_mode,
    'active',
    target_title
  );

  perform private.append_business_audit(
    org_id,
    'ai.session.created',
    new_session_id,
    'succeeded',
    jsonb_build_object(
      'ai_session_id', new_session_id,
      'problem_solving_case_id', target_problem_solving_case_id,
      'mode', target_mode
    )
  );

  return new_session_id;
end;
$$;

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

  if not private.can_read_problem_solving_case(
    org_id,
    session_row.problem_solving_case_id
  ) then
    raise exception 'problem solving case access required'
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
      'user_message_id', new_message_id
    )
  );

  return new_run_id;
end;
$$;

create or replace function private.fail_ai_run(
  target_ai_run_id uuid,
  target_error_category text,
  target_final_output text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  run_row public.ai_runs%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run failure recording is not authorised'
      using errcode = '42501';
  end if;

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    raise exception 'ai run not found'
      using errcode = 'P0002';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run failure recording is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    return;
  end if;

  update public.ai_runs
  set status = case
        when target_error_category = 'timeout' then 'timed_out'
        when target_error_category = 'denied' then 'denied'
        else 'failed'
      end,
      error_category = btrim(target_error_category),
      final_output = target_final_output,
      completed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id;

  perform private.append_business_audit(
    org_id,
    'ai.run.failed',
    target_ai_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', target_ai_run_id,
      'error_category', target_error_category
    )
  );
end;
$$;

create or replace function private.reject_ai_proposal(
  target_ai_proposal_id uuid,
  target_rejection_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  proposal_row public.ai_proposals%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai proposal rejection is not authorised'
      using errcode = '42501';
  end if;

  select proposal_table.*
  into proposal_row
  from public.ai_proposals proposal_table
  where proposal_table.organisation_id = org_id
    and proposal_table.id = target_ai_proposal_id
  for update;

  if not found then
    raise exception 'ai proposal not found'
      using errcode = 'P0002';
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'ai proposal is not pending'
      using errcode = '55000';
  end if;

  if not private.can_read_ai_session(org_id, proposal_row.ai_session_id) then
    raise exception 'ai proposal rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.ai_proposals
  set status = 'rejected',
      resolved_at = statement_timestamp(),
      resolved_by_membership_id = actor_membership_id,
      rejection_reason = target_rejection_reason
  where organisation_id = org_id
    and id = target_ai_proposal_id;

  perform private.append_business_audit(
    org_id,
    'ai.proposal.rejected',
    target_ai_proposal_id,
    'succeeded',
    jsonb_build_object('ai_proposal_id', target_ai_proposal_id)
  );
end;
$$;

create or replace function private.update_organisation_ai_settings(
  target_ai_enabled boolean,
  target_monthly_token_ceiling integer default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ai_settings(org_id) then
    raise exception 'ai settings update is not authorised'
      using errcode = '42501';
  end if;

  if target_monthly_token_ceiling is not null
    and target_monthly_token_ceiling <= 0 then
    raise exception 'invalid monthly token ceiling'
      using errcode = '22023';
  end if;

  update public.organisation_ai_settings
  set ai_enabled = target_ai_enabled,
      monthly_token_ceiling = target_monthly_token_ceiling,
      updated_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where organisation_id = org_id;

  if not found then
    insert into public.organisation_ai_settings (
      organisation_id,
      ai_enabled,
      monthly_token_ceiling,
      updated_by_membership_id
    )
    values (
      org_id,
      target_ai_enabled,
      target_monthly_token_ceiling,
      actor_membership_id
    );
  end if;
end;
$$;

-- Public wrappers

create or replace function public.create_ai_session(
  target_problem_solving_case_id uuid,
  target_mode text,
  target_problem_solving_session_id uuid default null,
  target_title text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_ai_session(
    target_problem_solving_case_id,
    target_mode,
    target_problem_solving_session_id,
    target_title
  )
$$;

create or replace function public.start_ai_run(
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
language sql
volatile
security definer
set search_path = ''
as $$
  select private.start_ai_run(
    target_ai_session_id,
    target_user_message,
    target_idempotency_key,
    target_provider,
    target_model,
    target_prompt_key,
    target_prompt_version,
    target_prompt_hash
  )
$$;

create or replace function public.fail_ai_run(
  target_ai_run_id uuid,
  target_error_category text,
  target_final_output text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.fail_ai_run(
    target_ai_run_id,
    target_error_category,
    target_final_output
  )
$$;

create or replace function public.reject_ai_proposal(
  target_ai_proposal_id uuid,
  target_rejection_reason text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reject_ai_proposal(
    target_ai_proposal_id,
    target_rejection_reason
  )
$$;

create or replace function public.update_organisation_ai_settings(
  target_ai_enabled boolean,
  target_monthly_token_ceiling integer default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_organisation_ai_settings(
    target_ai_enabled,
    target_monthly_token_ceiling
  )
$$;

grant execute on function public.create_ai_session(uuid, text, uuid, text) to authenticated;
grant execute on function public.start_ai_run(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.fail_ai_run(uuid, text, text) to authenticated;
grant execute on function public.reject_ai_proposal(uuid, text) to authenticated;
grant execute on function public.update_organisation_ai_settings(boolean, integer) to authenticated;

revoke all on function public.create_ai_session(uuid, text, uuid, text) from public, anon;
revoke all on function public.start_ai_run(uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.fail_ai_run(uuid, text, text) from public, anon;
revoke all on function public.reject_ai_proposal(uuid, text) from public, anon;
revoke all on function public.update_organisation_ai_settings(boolean, integer) from public, anon;

alter function private.create_ai_session(uuid, text, uuid, text) owner to lean_hub_private_owner;
alter function private.start_ai_run(uuid, text, text, text, text, text, text, text) owner to lean_hub_private_owner;
alter function private.fail_ai_run(uuid, text, text) owner to lean_hub_private_owner;
alter function private.reject_ai_proposal(uuid, text) owner to lean_hub_private_owner;
alter function private.update_organisation_ai_settings(boolean, integer) owner to lean_hub_private_owner;
