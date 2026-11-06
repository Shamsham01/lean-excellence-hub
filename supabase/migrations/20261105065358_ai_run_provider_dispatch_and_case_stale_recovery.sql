-- Record provider dispatch before the HTTP call returns, and recover orphaned
-- running rows when an authorised member opens the problem-solving case.

alter table public.ai_runs
  add column if not exists provider_dispatched_at timestamptz;

comment on column public.ai_runs.provider_dispatched_at is
  'Set once when provider execution starts. Survives host termination before a response id is stored.';

create or replace function private.record_ai_run_provider_dispatch(
  target_ai_run_id uuid
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
    raise exception 'ai run dispatch recording is not authorised'
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
    raise exception 'ai run dispatch recording is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    return;
  end if;

  if run_row.provider_dispatched_at is not null then
    return;
  end if;

  update public.ai_runs
  set provider_dispatched_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id
    and status = 'running'
    and provider_dispatched_at is null;
end;
$$;

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

  if target_stale_after_seconds is null or target_stale_after_seconds <= 0 then
    return 0;
  end if;

  if not private.can_read_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem solving case access required'
      using errcode = '42501';
  end if;

  cutoff := statement_timestamp() - make_interval(secs => target_stale_after_seconds);

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

create or replace function public.record_ai_run_provider_dispatch(
  target_ai_run_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_ai_run_provider_dispatch(target_ai_run_id)
$$;

create or replace function public.recover_stale_ai_runs_for_problem_solving_case(
  target_problem_solving_case_id uuid,
  target_stale_after_seconds integer default 65
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.recover_stale_ai_runs_for_problem_solving_case(
    target_problem_solving_case_id,
    target_stale_after_seconds
  )
$$;

alter function private.record_ai_run_provider_dispatch(uuid)
  owner to lean_hub_private_owner;
alter function private.recover_stale_ai_runs_for_problem_solving_case(uuid, integer)
  owner to lean_hub_private_owner;

grant execute on function public.record_ai_run_provider_dispatch(uuid) to authenticated;
grant execute on function public.recover_stale_ai_runs_for_problem_solving_case(uuid, integer) to authenticated;

revoke all on function public.record_ai_run_provider_dispatch(uuid) from public, anon;
revoke all on function public.recover_stale_ai_runs_for_problem_solving_case(uuid, integer) from public, anon;
