-- Audit remediation: wrapper grant hardening, direct-table plan gates, credit ledger RLS,
-- and settle/release for in-flight reservations when enforcement is toggled mid-run.

-- ---------------------------------------------------------------------------
-- Credit ledger: FORCE RLS + mid-run settle/release
-- ---------------------------------------------------------------------------

alter table public.organisation_ai_credit_periods force row level security;
alter table public.organisation_ai_credit_reservations force row level security;

create or replace function private.ai_credit_settle(
  target_ai_run_id uuid,
  target_actual_credits bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  reservation_row public.organisation_ai_credit_reservations%rowtype;
begin
  if org_id is null then
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
  for update;

  if not found or reservation_row.status <> 'reserved' then
    return;
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = period_table.reserved_credits - reservation_row.reserved_credits,
      consumed_credits = period_table.consumed_credits + target_actual_credits
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'settled',
      settled_credits = target_actual_credits,
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;
end;
$$;

create or replace function private.ai_credit_release(
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
  reservation_row public.organisation_ai_credit_reservations%rowtype;
begin
  if org_id is null then
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
    and reservation_table.status = 'reserved'
  for update;

  if not found then
    return;
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = greatest(
    0,
    period_table.reserved_credits - reservation_row.reserved_credits
  )
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'released',
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects: remove stale single-arg completion bypass; gate direct ci_projects UPDATE
-- ---------------------------------------------------------------------------

drop function if exists public.complete_project(uuid);
drop function if exists private.complete_project(uuid);

drop policy if exists ci_projects_update_manage on public.ci_projects;

create policy ci_projects_update_manage
on public.ci_projects for update to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_manage_ci_project_in_unit(organisation_id, unit_id)
  and public.current_organisation_plan_module_entitled('projects')
)
with check (
  organisation_id = private.current_organisation_id()
  and private.can_manage_ci_project_in_unit(organisation_id, unit_id)
  and public.current_organisation_plan_module_entitled('projects')
);

-- ---------------------------------------------------------------------------
-- Problem solving evidence: ensure authenticated cannot call legacy private overload
-- ---------------------------------------------------------------------------

do $$
declare
  signature_row record;
begin
  for signature_row in
    select pg_catalog.pg_get_function_identity_arguments(proc.oid) as args
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'private'
      and proc.proname = 'link_problem_solving_evidence'
  loop
    execute format(
      'revoke all on function private.link_problem_solving_evidence(%s) from public, anon, authenticated',
      signature_row.args
    );
  end loop;
end $$;
