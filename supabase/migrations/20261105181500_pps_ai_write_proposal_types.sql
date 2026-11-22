-- Problem Solving: extend Lean AI proposal types for structured write tools.

alter table public.ai_proposals
  drop constraint ai_proposals_type_check;

alter table public.ai_proposals
  add constraint ai_proposals_type_check
  check (
    proposal_type in (
      'current_condition_item',
      'hypothesis',
      'hypothesis_test',
      'containment',
      'countermeasure',
      'universal_action',
      'effectiveness_check',
      'sustainment_item',
      'session_question',
      'session_summary',
      'lessons_learned',
      'problem_statement',
      'five_why_chain',
      'fishbone_cause'
    )
  );

create or replace function private.update_problem_solving_problem_statement(
  target_case_id uuid,
  target_problem_statement text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'problem statement update is not authorised'
      using errcode = '42501';
  end if;

  if btrim(coalesce(target_problem_statement, '')) = '' then
    raise exception 'problem statement is required'
      using errcode = '22023';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case is not open for problem statement updates'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'problem statement update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set problem_statement = btrim(target_problem_statement)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  return true;
end;
$$;

create or replace function public.update_problem_solving_problem_statement(
  target_case_id uuid,
  target_problem_statement text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_problem_solving_problem_statement(
    target_case_id,
    target_problem_statement
  )
$$;

grant execute on function public.update_problem_solving_problem_statement(uuid, text)
  to authenticated;

revoke all on function public.update_problem_solving_problem_statement(uuid, text)
  from public, anon;

alter function private.update_problem_solving_problem_statement(uuid, text)
  owner to lean_hub_private_owner;

revoke all on function private.update_problem_solving_problem_statement(uuid, text)
  from public;

grant execute on function private.update_problem_solving_problem_statement(uuid, text)
  to lean_hub_private_owner;
