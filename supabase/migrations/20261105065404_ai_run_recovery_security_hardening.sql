-- Security hardening for AI run dispatch recording and case-scoped stale recovery.

set local lock_timeout = '5s';

create or replace function private.recover_stale_ai_runs_for_problem_solving_case(
  target_problem_solving_case_id uuid,
  target_stale_after_seconds integer default 65
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  stale_seconds integer := greatest(coalesce(target_stale_after_seconds, 65), 65);
  cutoff timestamptz;
  recovered integer := 0;
  run_row record;
  failure_category text;
  failure_output text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai stale recovery is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem solving case access required'
      using errcode = '42501';
  end if;

  cutoff := statement_timestamp() - make_interval(secs => stale_seconds);

  for run_row in
    select
      run_table.id,
      run_table.provider_dispatched_at,
      run_table.provider_request_id
    from public.ai_runs run_table
    inner join public.ai_sessions session_table
      on session_table.organisation_id = run_table.organisation_id
      and session_table.id = run_table.ai_session_id
    where run_table.organisation_id = org_id
      and session_table.problem_solving_case_id = target_problem_solving_case_id
      and run_table.status = 'running'
      and run_table.requested_by_membership_id = actor_membership_id
      and run_table.started_at <= cutoff
    order by run_table.started_at asc
    limit 20
    for update of run_table skip locked
  loop
    if run_row.provider_dispatched_at is not null
      and run_row.provider_request_id is null then
      failure_category := 'interrupted_unknown_billing';
      failure_output :=
        'Lean AI lost contact with the provider before this turn finished. External usage may still apply. Nothing was applied to your case — retry when ready.';
    else
      failure_category := 'timeout';
      failure_output :=
        'Lean AI did not finish before the hosting limit. Nothing was applied — you can retry safely.';
    end if;

    perform private.fail_ai_run(
      run_row.id,
      failure_category,
      failure_output
    );
    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

drop function if exists public.recover_stale_ai_runs_for_problem_solving_case(uuid, integer);

create or replace function public.recover_stale_ai_runs_for_problem_solving_case(
  target_problem_solving_case_id uuid
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.recover_stale_ai_runs_for_problem_solving_case(
    target_problem_solving_case_id,
    65
  )
$$;

revoke all on function private.record_ai_run_provider_dispatch(uuid)
  from public, anon, authenticated;
revoke all on function private.recover_stale_ai_runs_for_problem_solving_case(uuid, integer)
  from public, anon, authenticated;
revoke all on function private.fail_ai_run(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.recover_stale_ai_runs_for_problem_solving_case(uuid) to authenticated;
revoke all on function public.recover_stale_ai_runs_for_problem_solving_case(uuid) from public, anon;

alter function private.recover_stale_ai_runs_for_problem_solving_case(uuid, integer)
  owner to lean_hub_private_owner;
