-- Milestone 12: problem solving lessons learned operation and AI hardening.

create or replace function private.create_problem_solving_lessons_learned(
  target_case_id uuid,
  target_what_happened text,
  target_what_learned text,
  target_standardise text default null,
  target_apply_elsewhere text default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'lessons learned creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_lessons_learned (
    organisation_id,
    case_id,
    what_happened,
    what_learned,
    standardise,
    apply_elsewhere,
    notes,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_what_happened),
    btrim(target_what_learned),
    target_standardise,
    target_apply_elsewhere,
    target_notes,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.lessons_learned.created',
    target_case_id,
    'succeeded',
    jsonb_build_object('lesson_learned_id', new_id)
  );

  return new_id;
end;
$$;

create or replace function public.create_problem_solving_lessons_learned(
  target_case_id uuid,
  target_what_happened text,
  target_what_learned text,
  target_standardise text default null,
  target_apply_elsewhere text default null,
  target_notes text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_problem_solving_lessons_learned(
    target_case_id,
    target_what_happened,
    target_what_learned,
    target_standardise,
    target_apply_elsewhere,
    target_notes
  )
$$;

grant execute on function public.create_problem_solving_lessons_learned(
  uuid, text, text, text, text, text
) to authenticated;

revoke all on function public.create_problem_solving_lessons_learned(
  uuid, text, text, text, text, text
) from public, anon;

alter function private.create_problem_solving_lessons_learned(
  uuid, text, text, text, text, text
) owner to lean_hub_private_owner;

-- Append-only enforcement for usage ledger.
create or replace function private.prevent_ai_usage_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ai usage events are append-only'
    using errcode = '55000';
end;
$$;

create trigger ai_usage_events_append_only
before update or delete on public.ai_usage_events
for each row execute function private.prevent_ai_usage_event_mutation();

alter function private.prevent_ai_usage_event_mutation() owner to lean_hub_private_owner;

-- FTS index for similar case search.
create index if not exists problem_solving_cases_search_idx
  on public.problem_solving_cases
  using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(problem_statement, '')
    )
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
  target_lesson_learned_id uuid default null
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
    lesson_learned_id
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
    target_lesson_learned_id
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
  target_lesson_learned_id uuid default null
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
    target_lesson_learned_id
  )
$$;

grant execute on function public.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

revoke all on function public.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon;

alter function private.record_ai_proposal_accepted(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) owner to lean_hub_private_owner;
