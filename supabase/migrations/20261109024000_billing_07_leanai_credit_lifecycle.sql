-- BILLING-07: Wire credit reserve/settle/release into AI run lifecycle (testable
-- when organisation_ai_settings.credit_policy_enforced = true).

grant select, insert, update on public.organisation_ai_credit_periods to lean_hub_private_owner;
grant select, insert, update on public.organisation_ai_credit_reservations to lean_hub_private_owner;

create or replace function private.estimate_ai_run_credits(
  target_ai_run_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    1::bigint,
    coalesce(
      (
        select sum(
          usage_row.input_tokens
          + usage_row.output_tokens
          + usage_row.reasoning_tokens
        )::bigint
        from public.ai_usage_events usage_row
        where usage_row.ai_run_id = target_ai_run_id
      ),
      1::bigint
    )
  )
$$;

revoke all on function private.estimate_ai_run_credits(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.estimate_ai_run_credits(uuid)
  to lean_hub_private_owner;
alter function private.estimate_ai_run_credits(uuid) owner to lean_hub_private_owner;

create or replace function public.get_organisation_ai_credit_period_summary()
returns table (
  period_start timestamptz,
  period_end timestamptz,
  allowance_credits bigint,
  reserved_credits bigint,
  consumed_credits bigint,
  remaining_credits bigint,
  enforcement_enabled boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  period_id uuid;
begin
  if org_id is null then
    return;
  end if;

  period_id := private.ensure_organisation_ai_credit_period(org_id);

  return query
  select
    period_table.period_start,
    period_table.period_end,
    period_table.allowance_credits,
    period_table.reserved_credits,
    period_table.consumed_credits,
    greatest(
      0::bigint,
      period_table.allowance_credits
        - period_table.reserved_credits
        - period_table.consumed_credits
    ),
    private.leanai_credit_policy_enforced(org_id)
  from public.organisation_ai_credit_periods period_table
  where period_table.id = period_id;
end;
$$;

revoke all on function public.get_organisation_ai_credit_period_summary()
  from public, anon, service_role;
grant execute on function public.get_organisation_ai_credit_period_summary()
  to authenticated;

create or replace function private.finish_ai_run(
  target_ai_run_id uuid,
  target_assistant_content text,
  target_structured_payload jsonb,
  target_manifest_version text,
  target_manifest_json jsonb,
  target_manifest_hash text,
  target_provider_request_id text default null,
  target_tool_calls jsonb default '[]'::jsonb,
  target_source_references jsonb default '[]'::jsonb,
  target_proposals jsonb default '[]'::jsonb,
  target_input_tokens integer default 0,
  target_output_tokens integer default 0,
  target_cached_input_tokens integer default 0,
  target_reasoning_tokens integer default 0,
  target_tool_call_count integer default 0,
  target_duration_ms integer default 0
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
  run_row public.ai_runs%rowtype;
  session_row public.ai_sessions%rowtype;
  assistant_message_id uuid;
  tool_item jsonb;
  source_item jsonb;
  proposal_item jsonb;
  new_proposal_id uuid;
  proposal_semantic_stage_key text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run completion is not authorised'
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
    raise exception 'ai run completion is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    raise exception 'ai run is not running'
      using errcode = '55000';
  end if;

  select session_table.*
  into session_row
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.id = run_row.ai_session_id;

  update public.ai_runs
  set status = 'completed',
      provider_request_id = target_provider_request_id,
      completed_at = statement_timestamp(),
      final_output = btrim(target_assistant_content),
      input_token_count = target_input_tokens,
      output_token_count = target_output_tokens,
      cached_input_token_count = target_cached_input_tokens,
      reasoning_token_count = target_reasoning_tokens,
      tool_call_count = target_tool_call_count
  where organisation_id = org_id
    and id = target_ai_run_id;

  insert into public.ai_messages (
    organisation_id,
    ai_session_id,
    role,
    content,
    ai_run_id,
    structured_payload
  )
  values (
    org_id,
    run_row.ai_session_id,
    'assistant',
    btrim(target_assistant_content),
    target_ai_run_id,
    target_structured_payload
  )
  returning id into assistant_message_id;

  insert into public.ai_run_context_manifest (
    ai_run_id,
    organisation_id,
    manifest_version,
    manifest_json,
    manifest_hash
  )
  values (
    target_ai_run_id,
    org_id,
    btrim(target_manifest_version),
    target_manifest_json,
    btrim(target_manifest_hash)
  );

  proposal_semantic_stage_key :=
    nullif(btrim(coalesce(target_manifest_json ->> 'stage_key', '')), '');

  for tool_item in
    select value
    from jsonb_array_elements(coalesce(target_tool_calls, '[]'::jsonb))
  loop
    insert into public.ai_tool_calls (
      organisation_id,
      ai_run_id,
      sequence_number,
      tool_name,
      arguments_json,
      arguments_hash,
      status,
      result_metadata_json,
      denial_reason,
      duration_ms
    )
    values (
      org_id,
      target_ai_run_id,
      (tool_item ->> 'sequence_number')::integer,
      tool_item ->> 'tool_name',
      tool_item -> 'arguments_json',
      tool_item ->> 'arguments_hash',
      tool_item ->> 'status',
      tool_item -> 'result_metadata_json',
      tool_item ->> 'denial_reason',
      coalesce((tool_item ->> 'duration_ms')::integer, 0)
    );
  end loop;

  for source_item in
    select value
    from jsonb_array_elements(coalesce(target_source_references, '[]'::jsonb))
  loop
    insert into public.ai_source_references (
      organisation_id,
      ai_run_id,
      ai_message_id,
      problem_solving_case_id,
      current_condition_item_id,
      containment_id,
      hypothesis_id,
      hypothesis_test_id,
      countermeasure_id,
      effectiveness_check_id,
      sustainment_item_id,
      problem_solving_session_id,
      action_id,
      lesson_learned_id
    )
    values (
      org_id,
      target_ai_run_id,
      assistant_message_id,
      (source_item ->> 'problem_solving_case_id')::uuid,
      (source_item ->> 'current_condition_item_id')::uuid,
      (source_item ->> 'containment_id')::uuid,
      (source_item ->> 'hypothesis_id')::uuid,
      (source_item ->> 'hypothesis_test_id')::uuid,
      (source_item ->> 'countermeasure_id')::uuid,
      (source_item ->> 'effectiveness_check_id')::uuid,
      (source_item ->> 'sustainment_item_id')::uuid,
      (source_item ->> 'problem_solving_session_id')::uuid,
      (source_item ->> 'action_id')::uuid,
      (source_item ->> 'lesson_learned_id')::uuid
    );
  end loop;

  for proposal_item in
    select value
    from jsonb_array_elements(coalesce(target_proposals, '[]'::jsonb))
  loop
  if proposal_item ->> 'proposal_type' in (
    'verify_root_cause',
    'close_case',
    'approve_benefit',
    'validate_saving',
    'assign_rbac'
  ) then
    raise exception 'forbidden ai proposal type'
      using errcode = '22023';
  end if;

    new_proposal_id := private.register_resource_record(
      org_id,
      'ai_proposal',
      gen_random_uuid(),
      actor_membership_id
    );

    insert into public.ai_proposals (
      id,
      organisation_id,
      ai_session_id,
      ai_run_id,
      ai_message_id,
      proposal_type,
      payload_json,
      human_explanation,
      display_permission_key,
      problem_solving_case_id,
      semantic_stage_key
    )
    values (
      new_proposal_id,
      org_id,
      run_row.ai_session_id,
      target_ai_run_id,
      assistant_message_id,
      proposal_item ->> 'proposal_type',
      proposal_item -> 'payload_json',
      proposal_item ->> 'human_explanation',
      proposal_item ->> 'display_permission_key',
      session_row.problem_solving_case_id,
      proposal_semantic_stage_key
    );
  end loop;

  insert into public.ai_usage_events (
    organisation_id,
    membership_id,
    ai_session_id,
    ai_run_id,
    provider,
    model,
    input_tokens,
    cached_input_tokens,
    output_tokens,
    reasoning_tokens,
    tool_call_count,
    duration_ms
  )
  values (
    org_id,
    actor_membership_id,
    run_row.ai_session_id,
    target_ai_run_id,
    run_row.provider,
    run_row.model,
    target_input_tokens,
    target_cached_input_tokens,
    target_output_tokens,
    target_reasoning_tokens,
    target_tool_call_count,
    target_duration_ms
  );

  perform private.append_business_audit(
    org_id,
    'ai.run.completed',
    target_ai_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', target_ai_run_id,
      'assistant_message_id', assistant_message_id
    )
  );

  perform private.ai_credit_settle(
    target_ai_run_id,
    greatest(
      1::bigint,
      (coalesce(target_input_tokens, 0) + coalesce(target_output_tokens, 0))::bigint
    )
  );

  return assistant_message_id;
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

  perform private.ai_credit_release(target_ai_run_id);

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
