-- Milestone 12: AI access helpers and RLS policies.

create or replace function private.can_use_ai(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships membership_row
    join public.organisation_ai_settings settings_row
      on settings_row.organisation_id = membership_row.organisation_id
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = private.current_membership_id(target_organisation_id)
      and membership_row.status = 'active'
      and settings_row.ai_enabled = true
      and (
        private.has_scoped_permission(target_organisation_id, 'ai.use', null, null)
        or private.has_scoped_permission(
          target_organisation_id,
          'ai.use',
          null,
          private.membership_primary_organisational_unit_id(
            target_organisation_id,
            membership_row.id
          )
        )
      )
  )
$$;

create or replace function private.can_view_ai_history(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(target_organisation_id, 'ai.view_history', null, null)
    or private.has_scoped_permission(
      target_organisation_id,
      'ai.view_history',
      null,
      private.membership_primary_organisational_unit_id(
        target_organisation_id,
        private.current_membership_id(target_organisation_id)
      )
    )
$$;

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
    join public.problem_solving_cases case_row
      on case_row.organisation_id = session_row.organisation_id
      and case_row.id = session_row.problem_solving_case_id
    where session_row.organisation_id = target_organisation_id
      and session_row.id = target_ai_session_id
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
$$;

create or replace function private.can_manage_ai_settings(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(target_organisation_id, 'ai.manage_settings', null, null)
    or private.has_scoped_permission(
      target_organisation_id,
      'ai.manage_settings',
      null,
      private.membership_primary_organisational_unit_id(
        target_organisation_id,
        private.current_membership_id(target_organisation_id)
      )
    )
$$;

create or replace function private.organisation_ai_monthly_token_usage(
  target_organisation_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(
      usage_row.input_tokens
      + usage_row.cached_input_tokens
      + usage_row.output_tokens
      + usage_row.reasoning_tokens
    ),
    0
  )
  from public.ai_usage_events usage_row
  where usage_row.organisation_id = target_organisation_id
    and usage_row.created_at >= date_trunc('month', statement_timestamp())
$$;

create policy ai_sessions_select
on public.ai_sessions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ai_session(organisation_id, id)
);

create policy ai_messages_select
on public.ai_messages for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ai_session(organisation_id, ai_session_id)
);

create policy ai_runs_select
on public.ai_runs for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.ai_sessions session_row
    where session_row.organisation_id = ai_runs.organisation_id
      and session_row.id = ai_runs.ai_session_id
      and private.can_read_ai_session(session_row.organisation_id, session_row.id)
  )
);

create policy ai_run_context_manifest_select
on public.ai_run_context_manifest for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.ai_runs run_row
    join public.ai_sessions session_row
      on session_row.organisation_id = run_row.organisation_id
      and session_row.id = run_row.ai_session_id
    where run_row.organisation_id = ai_run_context_manifest.organisation_id
      and run_row.id = ai_run_context_manifest.ai_run_id
      and private.can_read_ai_session(session_row.organisation_id, session_row.id)
  )
);

create policy ai_tool_calls_select
on public.ai_tool_calls for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.ai_runs run_row
    join public.ai_sessions session_row
      on session_row.organisation_id = run_row.organisation_id
      and session_row.id = run_row.ai_session_id
    where run_row.organisation_id = ai_tool_calls.organisation_id
      and run_row.id = ai_tool_calls.ai_run_id
      and private.can_read_ai_session(session_row.organisation_id, session_row.id)
  )
);

create policy ai_proposals_select
on public.ai_proposals for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ai_session(organisation_id, ai_session_id)
);

create policy ai_source_references_select
on public.ai_source_references for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    ai_run_id is not null
    and exists (
      select 1
      from public.ai_runs run_row
      join public.ai_sessions session_row
        on session_row.organisation_id = run_row.organisation_id
        and session_row.id = run_row.ai_session_id
      where run_row.organisation_id = ai_source_references.organisation_id
        and run_row.id = ai_source_references.ai_run_id
        and private.can_read_ai_session(session_row.organisation_id, session_row.id)
    )
    or ai_message_id is not null
    and exists (
      select 1
      from public.ai_messages message_row
      where message_row.organisation_id = ai_source_references.organisation_id
        and message_row.id = ai_source_references.ai_message_id
        and private.can_read_ai_session(message_row.organisation_id, message_row.ai_session_id)
    )
    or ai_proposal_id is not null
    and exists (
      select 1
      from public.ai_proposals proposal_row
      where proposal_row.organisation_id = ai_source_references.organisation_id
        and proposal_row.id = ai_source_references.ai_proposal_id
        and private.can_read_ai_session(proposal_row.organisation_id, proposal_row.ai_session_id)
    )
  )
);

create policy ai_acceptance_provenance_select
on public.ai_acceptance_provenance for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.ai_proposals proposal_row
    where proposal_row.organisation_id = ai_acceptance_provenance.organisation_id
      and proposal_row.id = ai_acceptance_provenance.ai_proposal_id
      and private.can_read_ai_session(proposal_row.organisation_id, proposal_row.ai_session_id)
  )
);

create policy ai_usage_events_select
on public.ai_usage_events for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    membership_id = private.current_membership_id(organisation_id)
    or private.can_manage_ai_settings(organisation_id)
  )
);

alter function private.can_use_ai(uuid) owner to lean_hub_private_owner;
alter function private.can_view_ai_history(uuid) owner to lean_hub_private_owner;
alter function private.can_read_ai_session(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_manage_ai_settings(uuid) owner to lean_hub_private_owner;
alter function private.organisation_ai_monthly_token_usage(uuid) owner to lean_hub_private_owner;

grant execute on function private.can_use_ai(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.can_read_ai_session(uuid, uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.can_manage_ai_settings(uuid) to authenticated, lean_hub_private_owner;

revoke all on function private.can_view_ai_history(uuid) from public;
revoke all on function private.organisation_ai_monthly_token_usage(uuid) from public;

grant execute on function private.can_view_ai_history(uuid) to lean_hub_private_owner;
grant execute on function private.organisation_ai_monthly_token_usage(uuid) to lean_hub_private_owner;

drop policy if exists organisation_ai_settings_select on public.organisation_ai_settings;

create policy organisation_ai_settings_select
on public.organisation_ai_settings for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_manage_ai_settings(organisation_id)
);
