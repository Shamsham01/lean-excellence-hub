-- PPS gap fixes: verify rules in DB, fishbone guards, optional expected result, effectiveness notes,
-- case audit activity, problem definition + fishbone audit trails.
-- FLAGGED: apply via repo migration only; do not apply manually to hosted Supabase from this agent run.

-- ── Schema ─────────────────────────────────────────────────────────────────

alter table public.problem_solving_hypothesis_tests
  alter column expected_result drop not null;

alter table public.problem_solving_hypothesis_tests
  drop constraint if exists problem_solving_hypothesis_tests_expected_result_check;

alter table public.problem_solving_hypothesis_tests
  add constraint problem_solving_hypothesis_tests_expected_result_check
    check (
      expected_result is null
      or (
        expected_result = btrim(expected_result)
        and char_length(expected_result) between 1 and 2000
      )
    );

alter table public.problem_solving_effectiveness_checks
  add column if not exists result_rationale text;

alter table public.problem_solving_effectiveness_checks
  drop constraint if exists ps_effectiveness_checks_result_rationale_check;

alter table public.problem_solving_effectiveness_checks
  add constraint ps_effectiveness_checks_result_rationale_check
    check (
      result_rationale is null
      or char_length(result_rationale) between 1 and 4000
    );

alter table public.problem_solving_effectiveness_checks
  drop constraint if exists ps_effectiveness_checks_result_note_required;

alter table public.problem_solving_effectiveness_checks
  add constraint ps_effectiveness_checks_result_note_required
    check (
      result is null
      or result = 'pass'
      or (result_rationale is not null and btrim(result_rationale) <> '')
    );

create index if not exists business_audit_events_org_resource_created_idx
  on public.business_audit_events (organisation_id, resource_record_id, created_at desc);

-- ── Verify eligibility (mirrors app hypothesis-verification-rules) ───────────

create or replace function private.hypothesis_verify_cause_allowed(
  target_organisation_id uuid,
  target_hypothesis_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  interview_only_support boolean := false;
  latest_refutes_blocks boolean := false;
begin
  select coalesce(
    (
      select bool_and(btrim(coalesce(test_row.method, '')) = 'Interview')
      from public.problem_solving_hypothesis_tests test_row
      where test_row.organisation_id = target_organisation_id
        and test_row.hypothesis_id = target_hypothesis_id
        and test_row.completed_date is not null
        and test_row.conclusion = 'supports'
    ),
    false
  )
  into interview_only_support;

  if interview_only_support then
    raise exception 'Confirm with observation, data or a trial'
      using errcode = '55000';
  end if;

  select exists (
    with completed as (
      select
        test_row.conclusion,
        test_row.completed_date,
        test_row.created_at
      from public.problem_solving_hypothesis_tests test_row
      where test_row.organisation_id = target_organisation_id
        and test_row.hypothesis_id = target_hypothesis_id
        and test_row.completed_date is not null
        and test_row.conclusion is not null
    ),
    newest as (
      select completed.conclusion, completed.completed_date, completed.created_at
      from completed
      order by completed.completed_date desc, completed.created_at desc
      limit 1
    )
    select 1
    from newest
    where newest.conclusion = 'refutes'
      and not exists (
        select 1
        from completed other
        where other.conclusion = 'supports'
          and (
            other.completed_date > newest.completed_date
            or (
              other.completed_date = newest.completed_date
              and other.created_at > newest.created_at
            )
          )
      )
  )
  into latest_refutes_blocks;

  if latest_refutes_blocks then
    raise exception
      'The latest completed test refutes this hypothesis. Record a newer supporting test before verifying.'
      using errcode = '55000';
  end if;
end;
$$;

alter function private.hypothesis_verify_cause_allowed(uuid, uuid) owner to lean_hub_private_owner;
revoke all on function private.hypothesis_verify_cause_allowed(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.hypothesis_verify_cause_allowed(uuid, uuid) to lean_hub_private_owner;

create or replace function private.verify_cause_hypothesis(
  target_hypothesis_id uuid,
  target_verification_rationale text
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis verification is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_verify_cause_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'verify_cause permission is required'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id = hypothesis_row.problem_solving_case_id
      and case_row.status in ('closed', 'cancelled')
    for share
  ) then
    raise exception 'case is closed; hypothesis cannot be changed'
      using errcode = '55000';
  end if;

  if hypothesis_row.status = 'proposed' then
    raise exception 'proposed hypotheses cannot be directly verified; advance to testing or supported first'
      using errcode = '55000';
  end if;

  if hypothesis_row.status not in ('testing', 'supported') then
    raise exception 'hypothesis is not in a verifiable state'
      using errcode = '55000';
  end if;

  if target_verification_rationale is null
    or btrim(target_verification_rationale) = '' then
    raise exception 'verification_rationale is required'
      using errcode = '22023';
  end if;

  perform private.hypothesis_verify_cause_allowed(org_id, target_hypothesis_id);

  if not private.hypothesis_has_verification_basis(
    org_id,
    target_hypothesis_id,
    target_verification_rationale
  ) then
    raise exception 'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'verified',
      verified_by_membership_id = actor_membership_id,
      verified_at             = statement_timestamp(),
      verification_rationale  = btrim(target_verification_rationale),
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'verified',
    actor_membership_id, target_verification_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.verified',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_verification_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisVerified',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

alter function private.verify_cause_hypothesis(uuid, text) owner to lean_hub_private_owner;

-- ── Hypothesis tests: method required, expected encouraged ──────────────────

create or replace function private.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text default null,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
  resolved_owner_membership_id uuid;
  normalized_expected text;
  normalized_method text;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_test_question, '')) = '' then
    raise exception 'test question is required'
      using errcode = '22023';
  end if;

  normalized_method := nullif(btrim(coalesce(target_method, '')), '');
  if normalized_method is null then
    raise exception 'verification method is required'
      using errcode = '22023';
  end if;

  normalized_expected := nullif(btrim(coalesce(target_expected_result, '')), '');

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id = hypothesis_row.problem_solving_case_id
      and case_row.status in ('closed', 'cancelled')
    for share
  ) then
    raise exception 'case is closed; hypothesis cannot be changed'
      using errcode = '55000';
  end if;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'cannot create tests for a hypothesis in terminal state'
      using errcode = '55000';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  insert into public.problem_solving_hypothesis_tests (
    organisation_id,
    problem_solving_case_id,
    hypothesis_id,
    test_question,
    expected_result,
    method,
    owner_membership_id,
    planned_date,
    created_by_membership_id
  )
  values (
    org_id,
    hypothesis_row.problem_solving_case_id,
    target_hypothesis_id,
    btrim(target_test_question),
    normalized_expected,
    normalized_method,
    resolved_owner_membership_id,
    target_planned_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.created',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisTestCreated',
    new_id::text,
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

alter function private.create_hypothesis_test(uuid, text, text, text, uuid, date)
  owner to lean_hub_private_owner;

create or replace function public.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text default null,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_hypothesis_test(
  target_hypothesis_id,
  target_test_question,
  target_expected_result,
  target_method,
  target_owner_membership_id,
  target_planned_date
) $$;

grant execute on function public.create_hypothesis_test(uuid, text, text, text, uuid, date) to authenticated;
revoke all on function public.create_hypothesis_test(uuid, text, text, text, uuid, date) from public, anon;

-- ── Effectiveness: require notes for fail / inconclusive ────────────────────

create or replace function private.record_effectiveness_result(
  target_effectiveness_check_id uuid,
  target_result text,
  target_actual_numeric numeric default null,
  target_verification_rationale text default null
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
  check_row public.problem_solving_effectiveness_checks%rowtype;
  note_text text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'effectiveness result recording is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_result not in ('pass', 'fail', 'inconclusive') then
    raise exception 'invalid effectiveness result'
      using errcode = '22023';
  end if;

  note_text := nullif(btrim(coalesce(target_verification_rationale, '')), '');

  if target_result in ('fail', 'inconclusive') and note_text is null then
    raise exception 'result note is required for fail and inconclusive'
      using errcode = '22023';
  end if;

  select eff.*
  into check_row
  from public.problem_solving_effectiveness_checks eff
  where eff.organisation_id = org_id
    and eff.id = target_effectiveness_check_id
  for update;

  if not found then
    raise exception 'effectiveness check not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(org_id, check_row.case_id) then
    raise exception 'effectiveness result recording is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id = check_row.case_id
      and case_row.status in ('closed', 'cancelled')
    for share
  ) then
    raise exception 'case is closed; effectiveness cannot be changed'
      using errcode = '55000';
  end if;

  update public.problem_solving_effectiveness_checks eff
  set result = target_result,
      actual_numeric = target_actual_numeric,
      result_rationale = note_text,
      verified_by_membership_id = actor_membership_id,
      verified_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where eff.organisation_id = org_id
    and eff.id = target_effectiveness_check_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.effectiveness_recorded',
    check_row.case_id,
    'succeeded',
    jsonb_build_object(
      'effectiveness_check_id', target_effectiveness_check_id,
      'result', target_result,
      'note', note_text
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    check_row.case_id,
    'ProblemSolvingEffectivenessRecorded',
    target_effectiveness_check_id::text,
    jsonb_build_object(
      'case_id', check_row.case_id,
      'effectiveness_check_id', target_effectiveness_check_id,
      'result', target_result
    )
  );

  return true;
end;
$$;

alter function private.record_effectiveness_result(uuid, text, numeric, text)
  owner to lean_hub_private_owner;

-- ── Problem-solving actions: default assignee ───────────────────────────────

drop function if exists public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
);

create or replace function private.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_assignee_membership_id uuid default null
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
  case_unit_id uuid;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem-solving action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id = target_problem_solving_case_id
      and case_row.status in ('closed', 'cancelled')
    for share
  ) then
    raise exception 'case is closed; problem-solving action cannot be created'
      using errcode = '55000';
  end if;

  if target_context_role not in ('containment', 'countermeasure', 'sustainment') then
    raise exception 'invalid context role'
      using errcode = '22023';
  end if;

  if target_context_role = 'containment' and target_containment_id is null then
    raise exception 'containment actions require a containment_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'countermeasure' and target_countermeasure_id is null then
    raise exception 'countermeasure actions require a countermeasure_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'sustainment' and target_sustainment_item_id is null then
    raise exception 'sustainment actions require a sustainment_item_id'
      using errcode = '22023';
  end if;

  select case_row.organisation_unit_id
  into case_unit_id
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_problem_solving_case_id;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    case_unit_id,
    target_problem_solving_case_id,
    target_due_at,
    null
  );

  resolved_assignee := coalesce(target_assignee_membership_id, actor_membership_id);
  perform private.set_action_assignee(new_action_id, resolved_assignee);

  insert into public.problem_solving_action_context (
    organisation_id,
    problem_solving_case_id,
    action_id,
    context_role,
    containment_id,
    countermeasure_id,
    sustainment_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    new_action_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

alter function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
) owner to lean_hub_private_owner;

revoke all on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
) to lean_hub_private_owner;

drop function if exists private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz
);

create or replace function public.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_assignee_membership_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_problem_solving_action(
    target_title,
    target_problem_solving_case_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    target_description,
    target_priority,
    target_due_at,
    target_assignee_membership_id
  )
$$;

grant execute on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
) to authenticated;
revoke all on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
) from public, anon;

-- ── Case definition edits: audit ────────────────────────────────────────────

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

  perform private.assert_current_organisation_module_entitled('problem_solving');

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

  perform private.append_business_audit(
    org_id,
    'problem_solving.problem_statement_updated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', target_case_id,
      'excerpt', left(btrim(target_problem_statement), 240)
    )
  );

  return true;
end;
$$;

create or replace function private.update_problem_solving_target_condition(
  target_case_id uuid,
  target_target_condition text
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
    raise exception 'target condition update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_target_condition, '')) = '' then
    raise exception 'target condition is required'
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
    raise exception 'case is not open for target condition updates'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'target condition update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set target_condition = btrim(target_target_condition)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.target_condition_updated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', target_case_id,
      'excerpt', left(btrim(target_target_condition), 240)
    )
  );

  return true;
end;
$$;

-- ── Fishbone node mutations (hardened) ──────────────────────────────────────

create or replace function private.update_analysis_node(
  target_node_id uuid,
  target_label text
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  analysis_type text;
  rows_affected integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_label, '')) = '' then
    raise exception 'cause label is required'
      using errcode = '22023';
  end if;

  if char_length(btrim(target_label)) > 500 then
    raise exception 'cause label must be 500 characters or fewer'
      using errcode = '22023';
  end if;

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
  for update;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be changed here'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'analysis node update is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'promoted fishbone causes cannot be changed; edit the hypothesis instead'
      using errcode = '55000';
  end if;

  update public.problem_solving_analysis_nodes n
  set label = btrim(target_label)
  where n.organisation_id = org_id
    and n.id = target_node_id
    and n.linked_hypothesis_id is null;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    raise exception 'analysis node update had no effect'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving.fishbone_cause_updated',
    analysis_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', analysis_case_id,
      'node_id', target_node_id,
      'label', btrim(target_label)
    )
  );

  return true;
end;
$$;

create or replace function private.delete_analysis_node(
  target_node_id uuid
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  analysis_type text;
  rows_affected integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node deletion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
  for update;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be changed here'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'analysis node deletion is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'promoted fishbone causes cannot be removed; edit the hypothesis instead'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.problem_solving_analysis_nodes child
    where child.organisation_id = org_id
      and child.parent_node_id = target_node_id
  ) then
    raise exception 'remove child causes before deleting this node'
      using errcode = '55000';
  end if;

  delete from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
    and n.linked_hypothesis_id is null;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    raise exception 'analysis node deletion had no effect'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving.fishbone_cause_removed',
    analysis_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', analysis_case_id,
      'node_id', target_node_id,
      'label', node_row.label
    )
  );

  return true;
end;
$$;

drop function if exists public.promote_analysis_node_to_hypothesis(uuid, text, text);
drop function if exists private.promote_analysis_node_to_hypothesis(uuid, text, text);

create or replace function private.promote_analysis_node_to_hypothesis(
  target_node_id uuid,
  target_statement text default null,
  target_category text default null,
  target_problem_solving_case_id uuid default null
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  analysis_type text;
  statement_text text;
  category_text text;
  new_hypothesis_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis promotion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
  for update;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be promoted to a hypothesis'
      using errcode = '55000';
  end if;

  if target_problem_solving_case_id is not null
     and analysis_case_id is distinct from target_problem_solving_case_id then
    raise exception 'referenced cause is not valid for this case'
      using errcode = '22023';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'hypothesis promotion is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
    for share
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'this cause is already promoted to a hypothesis'
      using errcode = '55000';
  end if;

  statement_text := btrim(coalesce(target_statement, node_row.label));
  if statement_text = '' then
    raise exception 'hypothesis statement is required'
      using errcode = '22023';
  end if;

  if char_length(statement_text) > 2000 then
    raise exception 'hypothesis statement must be 2000 characters or fewer'
      using errcode = '22023';
  end if;

  category_text := nullif(btrim(coalesce(target_category, node_row.category)), '');

  new_hypothesis_id := private.create_hypothesis(
    analysis_case_id,
    statement_text,
    null,
    category_text,
    null
  );

  update public.problem_solving_analysis_nodes n
  set linked_hypothesis_id = new_hypothesis_id,
      updated_at           = statement_timestamp()
  where n.organisation_id = org_id
    and n.id = target_node_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.fishbone_cause_promoted',
    analysis_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', analysis_case_id,
      'node_id', target_node_id,
      'hypothesis_id', new_hypothesis_id,
      'statement', statement_text
    )
  );

  return new_hypothesis_id;
end;
$$;

create or replace function private.link_node_hypothesis(
  target_node_id uuid,
  target_hypothesis_id uuid
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  analysis_type text;
  hypothesis_case_id uuid;
  rows_affected integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
  for update;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  if node_row.linked_hypothesis_id is not null
     and node_row.linked_hypothesis_id is distinct from target_hypothesis_id then
    raise exception 'fishbone cause already has a different linked hypothesis'
      using errcode = '55000';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be linked to a hypothesis'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id = target_hypothesis_id then
    return true;
  end if;

  select h.problem_solving_case_id
  into hypothesis_case_id
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if hypothesis_case_id is null then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if analysis_case_id <> hypothesis_case_id then
    raise exception 'analysis node and hypothesis must belong to the same case'
      using errcode = '22023';
  end if;

  update public.problem_solving_analysis_nodes n
  set linked_hypothesis_id = target_hypothesis_id,
      updated_at           = statement_timestamp()
  where n.organisation_id = org_id
    and n.id = target_node_id
    and n.linked_hypothesis_id is null;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    raise exception 'node-hypothesis link had no effect'
      using errcode = '55000';
  end if;

  return true;
end;
$$;

alter function private.update_analysis_node(uuid, text) owner to lean_hub_private_owner;
alter function private.delete_analysis_node(uuid) owner to lean_hub_private_owner;
create or replace function public.promote_analysis_node_to_hypothesis(
  target_node_id uuid,
  target_statement text default null,
  target_category text default null,
  target_problem_solving_case_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.promote_analysis_node_to_hypothesis(
    target_node_id,
    target_statement,
    target_category,
    target_problem_solving_case_id
  )
$$;

grant execute on function public.promote_analysis_node_to_hypothesis(
  uuid, text, text, uuid
) to authenticated;
revoke all on function public.promote_analysis_node_to_hypothesis(
  uuid, text, text, uuid
) from public, anon;
revoke all on function private.promote_analysis_node_to_hypothesis(
  uuid, text, text, uuid
) from public;
grant execute on function private.promote_analysis_node_to_hypothesis(
  uuid, text, text, uuid
) to lean_hub_private_owner;

alter function private.promote_analysis_node_to_hypothesis(uuid, text, text, uuid) owner to lean_hub_private_owner;
alter function private.link_node_hypothesis(uuid, uuid) owner to lean_hub_private_owner;
alter function private.update_problem_solving_problem_statement(uuid, text) owner to lean_hub_private_owner;
alter function private.update_problem_solving_target_condition(uuid, text) owner to lean_hub_private_owner;

-- ── Case audit activity (for history view) ──────────────────────────────────

drop function if exists public.get_problem_solving_case_audit_activity(uuid);
drop function if exists private.list_problem_solving_case_audit_events(uuid);

create or replace function private.list_problem_solving_case_audit_events(
  target_case_id uuid,
  target_limit int default 50,
  target_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  page_limit int;
  result jsonb;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case audit history is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'case audit history is not authorised'
      using errcode = '42501';
  end if;

  page_limit := least(greatest(coalesce(target_limit, 50), 1), 200);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit_page.id,
        'event_action', audit_page.event_action,
        'event_outcome', audit_page.event_outcome,
        'actor_membership_id', audit_page.actor_membership_id,
        'metadata', audit_page.metadata,
        'created_at', audit_page.created_at
      )
      order by audit_page.created_at desc, audit_page.id desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select audit_event.id,
           audit_event.event_action,
           audit_event.event_outcome,
           audit_event.actor_membership_id,
           audit_event.metadata,
           audit_event.created_at
    from public.business_audit_events audit_event
    where audit_event.organisation_id = org_id
      and audit_event.resource_record_id = target_case_id
      and audit_event.event_action = any (
        array[
          'problem_solving.problem_statement_updated',
          'problem_solving.target_condition_updated',
          'problem_solving.fishbone_cause_updated',
          'problem_solving.fishbone_cause_removed',
          'problem_solving.fishbone_cause_promoted',
          'problem_solving.effectiveness_recorded',
          'hypothesis.verified',
          'hypothesis.rejected'
        ]
      )
      and (target_before is null or audit_event.created_at < target_before)
    order by audit_event.created_at desc, audit_event.id desc
    limit page_limit
  ) audit_page;

  return result;
end;
$$;

create or replace function public.get_problem_solving_case_audit_activity(
  target_case_id uuid,
  target_limit int default 50,
  target_before timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.list_problem_solving_case_audit_events(
    target_case_id,
    target_limit,
    target_before
  )
$$;

grant execute on function public.get_problem_solving_case_audit_activity(uuid, int, timestamptz) to authenticated;
revoke all on function public.get_problem_solving_case_audit_activity(uuid, int, timestamptz) from public, anon;
alter function private.list_problem_solving_case_audit_events(uuid, int, timestamptz) owner to lean_hub_private_owner;
revoke all on function private.list_problem_solving_case_audit_events(uuid, int, timestamptz) from public, anon, authenticated, service_role;
grant execute on function private.list_problem_solving_case_audit_events(uuid, int, timestamptz) to lean_hub_private_owner;

revoke all on function private.hypothesis_has_verification_basis(uuid, uuid, text) from public;
-- Include result_rationale on effectiveness checks in case detail.
create or replace function public.get_problem_solving_detail(
  target_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  case_row public.problem_solving_cases%rowtype;
  unit_row public.organisation_units%rowtype;
  status_history jsonb;
  stage_history jsonb;
  hypotheses jsonb;
  countermeasures jsonb;
  effectiveness_checks jsonb;
  sustainment_items jsonb;
  lessons_learned jsonb;
  sessions jsonb;
  actions jsonb;
  evidence_links jsonb;
  source_links jsonb;
  current_stage jsonb;
  membership_display_names jsonb;
begin
  if org_id is null then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = case_row.organisation_unit_id;

  -- Status history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sh.id,
        'from_status', sh.from_status,
        'to_status', sh.to_status,
        'changed_by_membership_id', sh.changed_by_membership_id,
        'rationale', sh.rationale,
        'changed_at', sh.changed_at
      )
      order by sh.changed_at
    ),
    '[]'::jsonb
  )
  into status_history
  from public.problem_solving_status_history sh
  where sh.organisation_id = org_id
    and sh.case_id = target_case_id;

  -- Stage history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sth.id,
        'from_stage_id', sth.from_stage_id,
        'to_stage_id', sth.to_stage_id,
        'from_stage', (
          select jsonb_build_object('title', fs.title, 'display_order', fs.display_order)
          from public.problem_solving_method_stages fs
          where fs.organisation_id = org_id and fs.id = sth.from_stage_id
        ),
        'to_stage', (
          select jsonb_build_object('title', ts.title, 'display_order', ts.display_order)
          from public.problem_solving_method_stages ts
          where ts.organisation_id = org_id and ts.id = sth.to_stage_id
        ),
        'changed_by_membership_id', sth.changed_by_membership_id,
        'changed_at', sth.changed_at,
        'notes', sth.notes
      )
      order by sth.changed_at
    ),
    '[]'::jsonb
  )
  into stage_history
  from public.problem_solving_stage_history sth
  where sth.organisation_id = org_id
    and sth.case_id = target_case_id;

  -- Current stage
  if case_row.current_method_stage_id is not null then
    select jsonb_build_object(
      'id', ms.id,
      'title', ms.title,
      'display_order', ms.display_order,
      'description', ms.description,
      'semantic_stage_key', ms.semantic_stage_key
    )
    into current_stage
    from public.problem_solving_method_stages ms
    where ms.organisation_id = org_id
      and ms.id = case_row.current_method_stage_id;
  end if;

  -- Hypotheses with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'statement', h.statement,
        'category', h.category,
        'status', h.status,
        'rationale', h.rationale,
        'verification_rationale', h.verification_rationale,
        'verified_by_membership_id', h.verified_by_membership_id,
        'verified_at', h.verified_at,
        'rejection_rationale', h.rejection_rationale,
        'rejected_by_membership_id', h.rejected_by_membership_id,
        'rejected_at', h.rejected_at,
        'parent_hypothesis_id', h.parent_hypothesis_id,
        'created_by_membership_id', h.created_by_membership_id,
        'created_at', h.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.hypothesis_id = h.id
          ),
          '[]'::jsonb
        )
      )
      order by h.created_at
    ),
    '[]'::jsonb
  )
  into hypotheses
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.problem_solving_case_id = target_case_id;

  -- Countermeasures with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cm.id,
        'title', cm.title,
        'description', cm.description,
        'rationale', cm.rationale,
        'status', cm.status,
        'proposed_by_membership_id', cm.proposed_by_membership_id,
        'selected_by_membership_id', cm.selected_by_membership_id,
        'selected_at', cm.selected_at,
        'selected_rationale', cm.selected_rationale,
        'rejected_by_membership_id', cm.rejected_by_membership_id,
        'rejected_at', cm.rejected_at,
        'rejected_rationale', cm.rejected_rationale,
        'created_at', cm.created_at,
        'cause_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', cl.id,
                'hypothesis_id', cl.hypothesis_id,
                'hypothesis_statement', (
                  select hh.statement
                  from public.problem_solving_hypotheses hh
                  where hh.organisation_id = org_id and hh.id = cl.hypothesis_id
                )
              )
            )
            from public.problem_solving_countermeasure_cause_links cl
            where cl.organisation_id = org_id
              and cl.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        ),
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        )
      )
      order by cm.created_at
    ),
    '[]'::jsonb
  )
  into countermeasures
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.problem_solving_case_id = target_case_id;

  -- Effectiveness checks
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', eff.id,
        'criterion', eff.criterion,
        'baseline_description', eff.baseline_description,
        'target_description', eff.target_description,
        'baseline_numeric', eff.baseline_numeric,
        'target_numeric', eff.target_numeric,
        'actual_numeric', eff.actual_numeric,
        'unit', eff.unit,
        'observation_window_start', eff.observation_window_start,
        'observation_window_end', eff.observation_window_end,
        'due_date', eff.due_date,
        'result', eff.result,
        'result_rationale', eff.result_rationale,
        'verified_by_membership_id', eff.verified_by_membership_id,
        'verified_at', eff.verified_at,
        'created_by_membership_id', eff.created_by_membership_id,
        'created_at', eff.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.effectiveness_check_id = eff.id
          ),
          '[]'::jsonb
        )
      )
      order by eff.created_at
    ),
    '[]'::jsonb
  )
  into effectiveness_checks
  from public.problem_solving_effectiveness_checks eff
  where eff.organisation_id = org_id
    and eff.case_id = target_case_id;

  -- Sustainment items
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'what', si.what,
        'owner_membership_id', si.owner_membership_id,
        'check_method', si.check_method,
        'follow_up_date', si.follow_up_date,
        'result', si.result,
        'training_session_id', si.training_session_id,
        'schedule_definition_id', si.schedule_definition_id,
        'evidence', si.evidence,
        'created_by_membership_id', si.created_by_membership_id,
        'created_at', si.created_at
      )
      order by si.created_at
    ),
    '[]'::jsonb
  )
  into sustainment_items
  from public.problem_solving_sustainment_items si
  where si.organisation_id = org_id
    and si.case_id = target_case_id;

  -- Lessons learned
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ll.id,
        'what_happened', ll.what_happened,
        'what_learned', ll.what_learned,
        'standardise', ll.standardise,
        'apply_elsewhere', ll.apply_elsewhere,
        'notes', ll.notes,
        'created_by_membership_id', ll.created_by_membership_id,
        'created_at', ll.created_at
      )
      order by ll.created_at
    ),
    '[]'::jsonb
  )
  into lessons_learned
  from public.problem_solving_lessons_learned ll
  where ll.organisation_id = org_id
    and ll.case_id = target_case_id;

  -- Sessions with participants and entry counts
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ps_session.id,
        'title', ps_session.title,
        'facilitator_membership_id', ps_session.facilitator_membership_id,
        'scheduled_at', ps_session.scheduled_at,
        'started_at', ps_session.started_at,
        'completed_at', ps_session.completed_at,
        'summary', ps_session.summary,
        'status', ps_session.status,
        'created_at', ps_session.created_at,
        'participants', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', sp.id,
                'membership_id', sp.membership_id,
                'added_at', sp.added_at
              )
            )
            from public.problem_solving_session_participants sp
            where sp.organisation_id = org_id
              and sp.session_id = ps_session.id
          ),
          '[]'::jsonb
        ),
        'entry_count', (
          select count(*)
          from public.problem_solving_session_entries se
          where se.organisation_id = org_id
            and se.session_id = ps_session.id
        )
      )
      order by ps_session.started_at desc nulls last, ps_session.created_at desc
    ),
    '[]'::jsonb
  )
  into sessions
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.case_id = target_case_id;

  -- Actions
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'description', a.description,
        'status', a.status,
        'priority', a.priority,
        'due_at', a.due_at,
        'completed_at', a.completed_at,
        'created_by_membership_id', a.created_by_membership_id,
        'context_role', ac.context_role,
        'countermeasure_id', ac.countermeasure_id,
        'containment_id', ac.containment_id,
        'sustainment_item_id', ac.sustainment_item_id,
        'created_at', a.created_at,
        'assignees', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'membership_id', aa.membership_id
              )
            )
            from public.action_assignees aa
            where aa.organisation_id = org_id
              and aa.action_id = a.id
          ),
          '[]'::jsonb
        )
      )
      order by a.created_at
    ),
    '[]'::jsonb
  )
  into actions
  from public.problem_solving_action_context ac
  join public.actions a
    on a.organisation_id = ac.organisation_id
   and a.id = ac.action_id
  where ac.organisation_id = org_id
    and ac.problem_solving_case_id = target_case_id
    and private.can_read_action(org_id, a.id);

  -- Evidence links (case-level)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', el.id,
        'attachment_id', el.attachment_id,
        'current_condition_item_id', el.current_condition_item_id,
        'containment_id', el.containment_id,
        'hypothesis_id', el.hypothesis_id,
        'hypothesis_test_id', el.hypothesis_test_id,
        'countermeasure_id', el.countermeasure_id,
        'effectiveness_check_id', el.effectiveness_check_id,
        'sustainment_item_id', el.sustainment_item_id,
        'session_id', el.session_id,
        'session_entry_id', el.session_entry_id,
        'is_case_level', el.is_case_level,
        'link_rationale', el.link_rationale,
        'created_by_membership_id', el.created_by_membership_id,
        'created_at', el.created_at
      )
      order by el.created_at
    ),
    '[]'::jsonb
  )
  into evidence_links
  from public.problem_solving_evidence_links el
  where el.organisation_id = org_id
    and el.problem_solving_case_id = target_case_id;

  -- Source links
  source_links := private.build_problem_solving_source_links_summary(org_id, target_case_id);
  membership_display_names := private.membership_public_display_names(
    org_id,
    (
      select coalesce(array_agg(distinct referenced.membership_id), '{}'::uuid[])
      from (
        select case_row.owner_membership_id as membership_id
        union
        select case_row.facilitator_membership_id
        union
        select case_row.created_by_membership_id
        union
        select case_row.closed_by_membership_id
        union
        select case_row.cancelled_by_membership_id
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(status_history, '[]'::jsonb)) history_entry
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(stage_history, '[]'::jsonb)) history_entry
        union
        select (hypothesis_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (countermeasure_entry->>'proposed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'selected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (effectiveness_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (effectiveness_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (sustainment_entry->>'owner_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (sustainment_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (lesson_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(lessons_learned, '[]'::jsonb)) lesson_entry
        union
        select (session_entry->>'facilitator_membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        union
        select (participant_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        cross join lateral jsonb_array_elements(
          coalesce(session_entry->'participants', '[]'::jsonb)
        ) participant_entry
        union
        select (evidence_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(evidence_links, '[]'::jsonb)) evidence_entry
        union
        select (action_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        union
        select (assignee_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        cross join lateral jsonb_array_elements(
          coalesce(action_entry->'assignees', '[]'::jsonb)
        ) assignee_entry
      ) referenced
      where referenced.membership_id is not null
    )
  );

  return jsonb_build_object(
    'id', case_row.id,
    'case_number', case_row.case_number,
    'title', case_row.title,
    'problem_statement', case_row.problem_statement,
    'background', case_row.background,
    'business_impact', case_row.business_impact,
    'scope_in', case_row.scope_in,
    'scope_out', case_row.scope_out,
    'target_condition', case_row.target_condition,
    'detected_at', case_row.detected_at,
    'status', case_row.status,
    'severity', case_row.severity,
    'priority', case_row.priority,
    'organisation_unit_id', case_row.organisation_unit_id,
    'unit_name', unit_row.name,
    'owner_membership_id', case_row.owner_membership_id,
    'owner_display_name', private.membership_public_display_name(
      org_id,
      case_row.owner_membership_id
    ),
    'facilitator_membership_id', case_row.facilitator_membership_id,
    'facilitator_display_name', private.membership_public_display_name(
      org_id,
      case_row.facilitator_membership_id
    ),
    'method_version_id', case_row.method_version_id,
    'current_method_stage_id', case_row.current_method_stage_id,
    'current_stage', current_stage,
    'closure_outcome', case_row.closure_outcome,
    'closure_rationale', case_row.closure_rationale,
    'transferred_to_reference', case_row.transferred_to_reference,
    'closed_at', case_row.closed_at,
    'closed_by_membership_id', case_row.closed_by_membership_id,
    'cancellation_rationale', case_row.cancellation_rationale,
    'cancelled_at', case_row.cancelled_at,
    'cancelled_by_membership_id', case_row.cancelled_by_membership_id,
    'target_due_at', case_row.target_due_at,
    'activated_at', case_row.activated_at,
    'created_by_membership_id', case_row.created_by_membership_id,
    'created_at', case_row.created_at,
    'updated_at', case_row.updated_at,
    'status_history', status_history,
    'stage_history', stage_history,
    'hypotheses', hypotheses,
    'countermeasures', countermeasures,
    'effectiveness_checks', effectiveness_checks,
    'sustainment_items', sustainment_items,
    'lessons_learned', lessons_learned,
    'sessions', sessions,
    'actions', actions,
    'evidence_links', evidence_links,
    'source_links', source_links,
    'membership_display_names', membership_display_names
  );
end;
$$;

-- Closure: inconclusive / fail / pending effectiveness block resolved outcomes (not transfer).
create or replace function private.close_problem_solving_case(
  target_case_id uuid,
  target_closure_outcome text,
  target_closure_rationale text default null
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
  has_verified_cause boolean;
  has_corrective_countermeasures boolean;
  has_effectiveness_checks boolean;
  all_effectiveness_passed boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case cannot be closed from current status'
      using errcode = '55000';
  end if;

  if not private.can_close_problem_solving_case(org_id, target_case_id) then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  if target_closure_outcome not in (
    'resolved_verified_cause',
    'resolved_without_verified_cause',
    'transferred'
  ) then
    raise exception 'invalid closure outcome'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.problem_solving_hypotheses h
    where h.organisation_id = org_id
      and h.problem_solving_case_id = target_case_id
      and h.status = 'verified'
  )
  into has_verified_cause;

  select exists (
    select 1
    from public.problem_solving_countermeasures cm
    where cm.organisation_id = org_id
      and cm.problem_solving_case_id = target_case_id
      and cm.status in ('selected', 'implementing', 'implemented', 'effective')
  )
  into has_corrective_countermeasures;

  if target_closure_outcome = 'resolved_verified_cause' then
    if not has_verified_cause then
      raise exception 'resolved_verified_cause requires at least one verified hypothesis'
        using errcode = '22023';
    end if;
  end if;

  if target_closure_outcome = 'resolved_without_verified_cause' then
    if target_closure_rationale is null or btrim(target_closure_rationale) = '' then
      raise exception 'resolved_without_verified_cause requires a closure rationale'
        using errcode = '22023';
    end if;

    if has_corrective_countermeasures then
      select exists (
        select 1
        from public.problem_solving_effectiveness_checks eff
        where eff.organisation_id = org_id
          and eff.case_id = target_case_id
      )
      into has_effectiveness_checks;

      if not has_effectiveness_checks then
        raise exception 'corrective countermeasures require effectiveness checks before closure'
          using errcode = '22023';
      end if;
    end if;
  end if;

  select exists (
    select 1
    from public.problem_solving_effectiveness_checks eff
    where eff.organisation_id = org_id
      and eff.case_id = target_case_id
  )
  into has_effectiveness_checks;

  if has_effectiveness_checks then
    select not exists (
      select 1
      from public.problem_solving_effectiveness_checks eff
      where eff.organisation_id = org_id
        and eff.case_id = target_case_id
        and (eff.result is null or eff.result in ('fail', 'inconclusive'))
    )
    into all_effectiveness_passed;

    if not all_effectiveness_passed and target_closure_outcome <> 'transferred' then
      raise exception 'all effectiveness checks must pass before closing as resolved'
        using errcode = '22023';
    end if;
  end if;

  update public.problem_solving_cases ps_case
  set status = 'closed',
      closure_outcome = target_closure_outcome,
      closure_rationale = target_closure_rationale,
      closed_at = statement_timestamp(),
      closed_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    case_row.status,
    'closed',
    actor_membership_id,
    target_closure_outcome || coalesce(': ' || target_closure_rationale, '')
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_closed',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'closure_outcome', target_closure_outcome,
      'has_verified_cause', has_verified_cause
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseClosed',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'closure_outcome', target_closure_outcome
    )
  );

  return true;
end;
$$;
