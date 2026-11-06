-- Regression fix: 20261106183000 replaced public.get_ai_session_detail with the
-- Milestone 12 shape (no Coach binding fields). Client-side readTrustedCoachConversation
-- requires context_type, module_key, and intervention_key; without them, every Coach
-- session read returns null, LeanAI server actions abort, and E2E sees no assistant UI.

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
