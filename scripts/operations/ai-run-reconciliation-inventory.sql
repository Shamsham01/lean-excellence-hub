-- Read-only inventory for stuck Problem Solving facilitator runs.
-- Do not UPDATE or DELETE from this script against production without owner approval.

-- Category legend (safe_action):
--   settle_timeout          — no provider dispatch recorded; fail as timeout when approved
--   settle_unknown_billing  — dispatch without response id; fail as interrupted_unknown_billing
--   await_reconcile         — provider response id present; reconcile before any row change
--   investigate             — completed without terminal usage row (unexpected)

with facilitator_runs as (
  select
    run_row.id,
    run_row.status,
    run_row.prompt_key,
    run_row.model,
    run_row.started_at,
    run_row.completed_at,
    run_row.execution_claimed_at,
    run_row.provider_dispatched_at,
    run_row.provider_request_id,
    run_row.input_token_count,
    run_row.output_token_count,
    run_row.tool_call_count,
    run_row.error_category,
    extract(epoch from (statement_timestamp() - run_row.started_at))::bigint
      as age_seconds,
    case
      when run_row.status <> 'running' then 'none'
      when run_row.provider_request_id is not null then 'await_reconcile'
      when run_row.provider_dispatched_at is not null then 'settle_unknown_billing'
      else 'settle_timeout'
    end as safe_action
  from public.ai_runs run_row
  where run_row.prompt_key = 'problem-solving-facilitator'
     or run_row.prompt_key like 'problem_solving%'
)
select
  status,
  safe_action,
  count(*) as run_count,
  min(age_seconds) filter (where status = 'running') as min_running_age_seconds,
  max(age_seconds) filter (where status = 'running') as max_running_age_seconds,
  count(*) filter (where execution_claimed_at is not null and status = 'running')
    as running_with_claim,
  count(*) filter (where provider_dispatched_at is not null and status = 'running')
    as running_with_dispatch
from facilitator_runs
group by status, safe_action
order by status, safe_action;
