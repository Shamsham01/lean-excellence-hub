-- Exclusive provider execution lease for an AI run.
-- Two serverless instances that share an idempotency key must not both call
-- the model. The row lock makes the claim atomic across connections.

alter table public.ai_runs
  add column if not exists execution_claimed_at timestamptz;

comment on column public.ai_runs.execution_claimed_at is
  'Set once when a server claims provider execution. A second claim sees this timestamp and must not call the provider again.';

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
    return 'in_progress';
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

create or replace function public.claim_ai_run_execution(
  target_ai_run_id uuid
)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select private.claim_ai_run_execution(target_ai_run_id)
$$;

alter function private.claim_ai_run_execution(uuid)
  owner to lean_hub_private_owner;

grant execute on function public.claim_ai_run_execution(uuid) to authenticated;
revoke all on function public.claim_ai_run_execution(uuid) from public, anon;
