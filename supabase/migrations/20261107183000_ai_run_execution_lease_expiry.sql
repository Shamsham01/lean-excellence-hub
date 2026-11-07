-- Expire abandoned execution leases so facilitator runs cannot stay `running`
-- after a serverless worker is killed past the Netlify synchronous limit.

set local lock_timeout = '5s';

create or replace function private.ai_run_abandoned_failure(
  target_provider_dispatched_at timestamptz,
  target_provider_request_id text
)
returns table (
  failure_category text,
  failure_output text
)
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    case
      when target_provider_dispatched_at is not null
        and nullif(btrim(coalesce(target_provider_request_id, '')), '') is null
        then 'interrupted_unknown_billing'
      else 'timeout'
    end,
    case
      when target_provider_dispatched_at is not null
        and nullif(btrim(coalesce(target_provider_request_id, '')), '') is null
        then 'Lean AI lost contact with the provider before this turn finished. External usage may still apply. Nothing was applied to your case — retry when ready.'
      else 'Lean AI did not finish before the hosting limit. Nothing was applied — you can retry safely.'
    end
$$;

create or replace function private.claim_ai_run_execution(
  target_ai_run_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  run_row public.ai_runs%rowtype;
  lease_seconds integer := 70;
  failure record;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run claim is not authorised'
      using errcode = '42501';
  end if;

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run claim is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status = 'completed' then
    return 'completed';
  end if;

  if run_row.status <> 'running' then
    return run_row.status;
  end if;

  if run_row.execution_claimed_at is not null then
    if run_row.execution_claimed_at >
      statement_timestamp() - make_interval(secs => lease_seconds) then
      return 'in_progress';
    end if;

    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      target_ai_run_id,
      failure.failure_category,
      failure.failure_output
    );

    select run_table.status
    into run_row.status
    from public.ai_runs run_table
    where run_table.organisation_id = org_id
      and run_table.id = target_ai_run_id;

    return run_row.status;
  end if;

  if run_row.started_at <= statement_timestamp() - make_interval(secs => lease_seconds) then
    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      target_ai_run_id,
      failure.failure_category,
      failure.failure_output
    );

    select run_table.status
    into run_row.status
    from public.ai_runs run_table
    where run_table.organisation_id = org_id
      and run_table.id = target_ai_run_id;

    return run_row.status;
  end if;

  update public.ai_runs
  set execution_claimed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id
    and status = 'running'
    and execution_claimed_at is null;

  if not found then
    return 'in_progress';
  end if;

  return 'claimed';
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
  stale_seconds integer := greatest(coalesce(target_stale_after_seconds, 65), 65);
  cutoff timestamptz;
  recovered integer := 0;
  run_row record;
  failure record;
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
      and greatest(
        run_table.started_at,
        coalesce(run_table.execution_claimed_at, run_table.started_at),
        coalesce(run_table.provider_dispatched_at, run_table.started_at)
      ) <= cutoff
    order by run_table.started_at asc
    limit 20
    for update of run_table skip locked
  loop
    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      run_row.id,
      failure.failure_category,
      failure.failure_output
    );
    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

alter function private.ai_run_abandoned_failure(timestamptz, text)
  owner to lean_hub_private_owner;
alter function private.claim_ai_run_execution(uuid)
  owner to lean_hub_private_owner;
alter function private.recover_stale_ai_runs_for_problem_solving_case(uuid, integer)
  owner to lean_hub_private_owner;
