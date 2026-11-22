-- Tag Lean AI proposals with the semantic method stage (manifest.stage_key) so pending
-- lists can be scoped per stage tab. Backfill from existing run manifests.

alter table public.ai_proposals
  add column if not exists semantic_stage_key text;

alter table public.ai_proposals
  add constraint ai_proposals_semantic_stage_key_trim_check
  check (
    semantic_stage_key is null
    or (
      semantic_stage_key = btrim(semantic_stage_key)
      and char_length(semantic_stage_key) between 1 and 80
    )
  );

update public.ai_proposals proposal_row
set semantic_stage_key = nullif(
  btrim(coalesce(manifest_row.manifest_json ->> 'stage_key', '')),
  ''
)
from public.ai_runs run_row
join public.ai_run_context_manifest manifest_row
  on manifest_row.organisation_id = run_row.organisation_id
  and manifest_row.ai_run_id = run_row.id
where proposal_row.ai_run_id = run_row.id
  and proposal_row.organisation_id = run_row.organisation_id
  and proposal_row.semantic_stage_key is null
  and nullif(btrim(coalesce(manifest_row.manifest_json ->> 'stage_key', '')), '')
    is not null;

create index if not exists ai_proposals_case_stage_pending_idx
  on public.ai_proposals (
    organisation_id,
    problem_solving_case_id,
    semantic_stage_key,
    status
  )
  where status = 'pending';

-- Persist semantic_stage_key when completing an AI run (same logic as Milestone 12).
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

  return assistant_message_id;
end;
$$;

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
      'problem_solving_case_id', session_row.problem_solving_case_id,
      'problem_solving_session_id', session_row.problem_solving_session_id,
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
        'semantic_stage_key', proposal_row.semantic_stage_key,
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

alter function private.finish_ai_run(
  uuid, text, jsonb, text, jsonb, text, text, jsonb, jsonb, jsonb,
  integer, integer, integer, integer, integer, integer
) owner to lean_hub_private_owner;
