-- AI acceptance provenance: allow case-level outcomes (problem statement, target condition)
-- and graph-based analyses (5 Why root-only, first fishbone node) where no typed FK row
-- exists but we still need exactly one non-null outcome reference.

alter table public.ai_acceptance_provenance
  add column if not exists problem_solving_case_id uuid;

alter table public.ai_acceptance_provenance
  drop constraint if exists ai_acceptance_provenance_problem_solving_case_id_fkey;

alter table public.ai_acceptance_provenance
  add constraint ai_acceptance_provenance_problem_solving_case_id_fkey
  foreign key (organisation_id, problem_solving_case_id)
  references public.problem_solving_cases (organisation_id, id)
  on delete restrict;

alter table public.ai_acceptance_provenance
  drop constraint if exists ai_acceptance_provenance_exact_one_check;

alter table public.ai_acceptance_provenance
  add constraint ai_acceptance_provenance_exact_one_check
  check (
    num_nonnulls(
      current_condition_item_id,
      containment_id,
      hypothesis_id,
      hypothesis_test_id,
      countermeasure_id,
      effectiveness_check_id,
      sustainment_item_id,
      problem_solving_session_id,
      session_entry_id,
      action_id,
      lesson_learned_id,
      problem_solving_case_id
    ) = 1
  );

create or replace function private.record_ai_proposal_accepted(
  target_ai_proposal_id uuid,
  target_current_condition_item_id uuid default null,
  target_containment_id uuid default null,
  target_hypothesis_id uuid default null,
  target_hypothesis_test_id uuid default null,
  target_countermeasure_id uuid default null,
  target_effectiveness_check_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_problem_solving_session_id uuid default null,
  target_session_entry_id uuid default null,
  target_action_id uuid default null,
  target_lesson_learned_id uuid default null,
  target_problem_solving_case_id uuid default null
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
  proposal_row public.ai_proposals%rowtype;
  outcome_count int;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai proposal acceptance recording is not authorised'
      using errcode = '42501';
  end if;

  select proposal_table.*
  into proposal_row
  from public.ai_proposals proposal_table
  where proposal_table.organisation_id = org_id
    and proposal_table.id = target_ai_proposal_id
  for update;

  if not found then
    raise exception 'ai proposal not found'
      using errcode = 'P0002';
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'ai proposal is not pending'
      using errcode = '55000';
  end if;

  if not private.can_read_ai_session(org_id, proposal_row.ai_session_id) then
    raise exception 'ai proposal acceptance recording is not authorised'
      using errcode = '42501';
  end if;

  outcome_count := num_nonnulls(
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_problem_solving_session_id,
    target_session_entry_id,
    target_action_id,
    target_lesson_learned_id,
    target_problem_solving_case_id
  );

  if outcome_count <> 1 then
    raise exception 'ai proposal acceptance requires exactly one outcome reference'
      using errcode = '23514';
  end if;

  if target_problem_solving_case_id is not null
     and target_problem_solving_case_id <> proposal_row.problem_solving_case_id then
    raise exception 'ai proposal outcome case mismatch'
      using errcode = '23514';
  end if;

  update public.ai_proposals
  set status = 'accepted',
      resolved_at = statement_timestamp(),
      resolved_by_membership_id = actor_membership_id
  where organisation_id = org_id
    and id = target_ai_proposal_id;

  insert into public.ai_acceptance_provenance (
    organisation_id,
    ai_proposal_id,
    accepted_by_membership_id,
    ai_run_id,
    current_condition_item_id,
    containment_id,
    hypothesis_id,
    hypothesis_test_id,
    countermeasure_id,
    effectiveness_check_id,
    sustainment_item_id,
    problem_solving_session_id,
    session_entry_id,
    action_id,
    lesson_learned_id,
    problem_solving_case_id
  )
  values (
    org_id,
    target_ai_proposal_id,
    actor_membership_id,
    proposal_row.ai_run_id,
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_problem_solving_session_id,
    target_session_entry_id,
    target_action_id,
    target_lesson_learned_id,
    target_problem_solving_case_id
  );

  perform private.append_business_audit(
    org_id,
    'ai.proposal.accepted',
    target_ai_proposal_id,
    'succeeded',
    jsonb_build_object('ai_proposal_id', target_ai_proposal_id)
  );
end;
$$;

create or replace function public.record_ai_proposal_accepted(
  target_ai_proposal_id uuid,
  target_current_condition_item_id uuid default null,
  target_containment_id uuid default null,
  target_hypothesis_id uuid default null,
  target_hypothesis_test_id uuid default null,
  target_countermeasure_id uuid default null,
  target_effectiveness_check_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_problem_solving_session_id uuid default null,
  target_session_entry_id uuid default null,
  target_action_id uuid default null,
  target_lesson_learned_id uuid default null,
  target_problem_solving_case_id uuid default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_ai_proposal_accepted(
    target_ai_proposal_id,
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_problem_solving_session_id,
    target_session_entry_id,
    target_action_id,
    target_lesson_learned_id,
    target_problem_solving_case_id
  )
$$;

-- CREATE OR REPLACE cannot change arity; the 13-arg definitions above are overloads.
-- Drop the legacy 12-arg signatures so PostgREST resolves a single public RPC.
drop function if exists public.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
);
drop function if exists private.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
);

grant execute on function public.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

revoke all on function public.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon;

alter function private.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) owner to lean_hub_private_owner;
