-- Milestone 11: effectiveness and sustainment authoritative operations.

create or replace function private.create_effectiveness_check(
  target_case_id uuid,
  target_criterion text,
  target_baseline_description text default null,
  target_target_description text default null,
  target_baseline_numeric numeric default null,
  target_target_numeric numeric default null,
  target_unit text default null,
  target_observation_window_start date default null,
  target_observation_window_end date default null,
  target_due_date date default null
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
  if org_id is null or actor_membership_id is null then
    raise exception 'effectiveness check creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'effectiveness check creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_effectiveness_checks (
    organisation_id,
    case_id,
    criterion,
    baseline_description,
    target_description,
    baseline_numeric,
    target_numeric,
    unit,
    observation_window_start,
    observation_window_end,
    due_date,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_criterion),
    target_baseline_description,
    target_target_description,
    target_baseline_numeric,
    target_target_numeric,
    target_unit,
    target_observation_window_start,
    target_observation_window_end,
    target_due_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.effectiveness_check_created',
    target_case_id,
    'succeeded',
    jsonb_build_object('effectiveness_check_id', new_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingEffectivenessCheckCreated',
    new_id::text,
    jsonb_build_object('case_id', target_case_id, 'effectiveness_check_id', new_id)
  );

  return new_id;
end;
$$;

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
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'effectiveness result recording is not authorised'
      using errcode = '42501';
  end if;

  if target_result not in ('pass', 'fail', 'inconclusive') then
    raise exception 'invalid effectiveness result'
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

  update public.problem_solving_effectiveness_checks eff
  set result = target_result,
      actual_numeric = target_actual_numeric,
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
      'result', target_result
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

create or replace function private.create_sustainment_item(
  target_case_id uuid,
  target_what text,
  target_owner_membership_id uuid default null,
  target_check_method text default null,
  target_follow_up_date date default null
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
  if org_id is null or actor_membership_id is null then
    raise exception 'sustainment item creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'sustainment item creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_sustainment_items (
    organisation_id,
    case_id,
    what,
    owner_membership_id,
    check_method,
    follow_up_date,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_what),
    target_owner_membership_id,
    target_check_method,
    target_follow_up_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.sustainment_item_created',
    target_case_id,
    'succeeded',
    jsonb_build_object('sustainment_item_id', new_id)
  );

  return new_id;
end;
$$;

create or replace function private.record_sustainment_result(
  target_sustainment_item_id uuid,
  target_result text,
  target_evidence text default null
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
  item_row public.problem_solving_sustainment_items%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'sustainment result recording is not authorised'
      using errcode = '42501';
  end if;

  select si.*
  into item_row
  from public.problem_solving_sustainment_items si
  where si.organisation_id = org_id
    and si.id = target_sustainment_item_id
  for update;

  if not found then
    raise exception 'sustainment item not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(org_id, item_row.case_id) then
    raise exception 'sustainment result recording is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_sustainment_items si
  set result = btrim(target_result),
      evidence = target_evidence,
      updated_at = statement_timestamp()
  where si.organisation_id = org_id
    and si.id = target_sustainment_item_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.sustainment_recorded',
    item_row.case_id,
    'succeeded',
    jsonb_build_object('sustainment_item_id', target_sustainment_item_id)
  );

  return true;
end;
$$;

create or replace function public.create_effectiveness_check(
  target_case_id uuid,
  target_criterion text,
  target_baseline_description text default null,
  target_target_description text default null,
  target_baseline_numeric numeric default null,
  target_target_numeric numeric default null,
  target_unit text default null,
  target_observation_window_start date default null,
  target_observation_window_end date default null,
  target_due_date date default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_effectiveness_check(
  target_case_id,
  target_criterion,
  target_baseline_description,
  target_target_description,
  target_baseline_numeric,
  target_target_numeric,
  target_unit,
  target_observation_window_start,
  target_observation_window_end,
  target_due_date
) $$;

create or replace function public.record_effectiveness_result(
  target_effectiveness_check_id uuid,
  target_result text,
  target_actual_numeric numeric default null,
  target_verification_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.record_effectiveness_result(
  target_effectiveness_check_id,
  target_result,
  target_actual_numeric,
  target_verification_rationale
) $$;

create or replace function public.create_sustainment_item(
  target_case_id uuid,
  target_what text,
  target_owner_membership_id uuid default null,
  target_check_method text default null,
  target_follow_up_date date default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_sustainment_item(
  target_case_id,
  target_what,
  target_owner_membership_id,
  target_check_method,
  target_follow_up_date
) $$;

create or replace function public.record_sustainment_result(
  target_sustainment_item_id uuid,
  target_result text,
  target_evidence text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.record_sustainment_result(
  target_sustainment_item_id,
  target_result,
  target_evidence
) $$;

grant execute on function public.create_effectiveness_check(
  uuid, text, text, text, numeric, numeric, text, date, date, date
) to authenticated;
grant execute on function public.record_effectiveness_result(uuid, text, numeric, text)
  to authenticated;
grant execute on function public.create_sustainment_item(uuid, text, uuid, text, date)
  to authenticated;
grant execute on function public.record_sustainment_result(uuid, text, text)
  to authenticated;

revoke all on function public.create_effectiveness_check(
  uuid, text, text, text, numeric, numeric, text, date, date, date
) from public, anon;
revoke all on function public.record_effectiveness_result(uuid, text, numeric, text)
  from public, anon;
revoke all on function public.create_sustainment_item(uuid, text, uuid, text, date)
  from public, anon;
revoke all on function public.record_sustainment_result(uuid, text, text)
  from public, anon;

alter function private.create_effectiveness_check(
  uuid, text, text, text, numeric, numeric, text, date, date, date
) owner to lean_hub_private_owner;
alter function private.record_effectiveness_result(uuid, text, numeric, text)
  owner to lean_hub_private_owner;
alter function private.create_sustainment_item(uuid, text, uuid, text, date)
  owner to lean_hub_private_owner;
alter function private.record_sustainment_result(uuid, text, text)
  owner to lean_hub_private_owner;
