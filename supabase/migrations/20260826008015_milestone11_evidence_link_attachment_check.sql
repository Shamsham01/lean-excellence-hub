-- Milestone 11: evidence link attachment validation must bypass reader RLS.

create or replace function private.attachment_is_active_in_organisation(
  target_organisation_id uuid,
  target_attachment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.organisation_id = target_organisation_id
      and attachment_row.id = target_attachment_id
      and attachment_row.lifecycle = 'active'
  )
$$;

alter function private.attachment_is_active_in_organisation(uuid, uuid) owner to postgres;

revoke all on function private.attachment_is_active_in_organisation(uuid, uuid) from public;
grant execute on function private.attachment_is_active_in_organisation(uuid, uuid)
  to lean_hub_private_owner;

create or replace function private.link_problem_solving_evidence(
  target_case_id uuid,
  target_attachment_id uuid,
  target_current_condition_item_id uuid default null,
  target_containment_id uuid default null,
  target_hypothesis_id uuid default null,
  target_hypothesis_test_id uuid default null,
  target_countermeasure_id uuid default null,
  target_effectiveness_check_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_session_id uuid default null,
  target_session_entry_id uuid default null,
  target_is_case_level boolean default false,
  target_link_rationale text default null
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
  case_row public.problem_solving_cases%rowtype;
  subject_count integer;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot link evidence to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not private.can_link_problem_solving_evidence(org_id, target_case_id) then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  subject_count :=
    (case when target_current_condition_item_id is not null then 1 else 0 end)
    + (case when target_containment_id is not null then 1 else 0 end)
    + (case when target_hypothesis_id is not null then 1 else 0 end)
    + (case when target_hypothesis_test_id is not null then 1 else 0 end)
    + (case when target_countermeasure_id is not null then 1 else 0 end)
    + (case when target_effectiveness_check_id is not null then 1 else 0 end)
    + (case when target_sustainment_item_id is not null then 1 else 0 end)
    + (case when target_session_id is not null then 1 else 0 end)
    + (case when target_session_entry_id is not null then 1 else 0 end)
    + (case when target_is_case_level then 1 else 0 end);

  if subject_count <> 1 then
    raise exception 'exactly one evidence subject must be specified'
      using errcode = '22023';
  end if;

  if target_current_condition_item_id is not null and not exists (
    select 1
    from public.problem_solving_current_condition_items item_row
    where item_row.organisation_id = org_id
      and item_row.id = target_current_condition_item_id
      and item_row.case_id = target_case_id
  ) then
    raise exception 'current condition item does not belong to this case'
      using errcode = '22023';
  end if;

  if target_containment_id is not null and not exists (
    select 1
    from public.problem_solving_containments containment_row
    where containment_row.organisation_id = org_id
      and containment_row.id = target_containment_id
      and containment_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'containment does not belong to this case'
      using errcode = '22023';
  end if;

  if target_hypothesis_id is not null and not exists (
    select 1
    from public.problem_solving_hypotheses hypothesis_row
    where hypothesis_row.organisation_id = org_id
      and hypothesis_row.id = target_hypothesis_id
      and hypothesis_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'hypothesis does not belong to this case'
      using errcode = '22023';
  end if;

  if target_hypothesis_test_id is not null and not exists (
    select 1
    from public.problem_solving_hypothesis_tests test_row
    join public.problem_solving_hypotheses hypothesis_row
      on hypothesis_row.organisation_id = test_row.organisation_id
     and hypothesis_row.id = test_row.hypothesis_id
    where test_row.organisation_id = org_id
      and test_row.id = target_hypothesis_test_id
      and hypothesis_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'hypothesis test does not belong to this case'
      using errcode = '22023';
  end if;

  if target_countermeasure_id is not null and not exists (
    select 1
    from public.problem_solving_countermeasures countermeasure_row
    where countermeasure_row.organisation_id = org_id
      and countermeasure_row.id = target_countermeasure_id
      and countermeasure_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'countermeasure does not belong to this case'
      using errcode = '22023';
  end if;

  if target_effectiveness_check_id is not null and not exists (
    select 1
    from public.problem_solving_effectiveness_checks effectiveness_row
    where effectiveness_row.organisation_id = org_id
      and effectiveness_row.id = target_effectiveness_check_id
      and effectiveness_row.case_id = target_case_id
  ) then
    raise exception 'effectiveness check does not belong to this case'
      using errcode = '22023';
  end if;

  if target_sustainment_item_id is not null and not exists (
    select 1
    from public.problem_solving_sustainment_items sustainment_row
    where sustainment_row.organisation_id = org_id
      and sustainment_row.id = target_sustainment_item_id
      and sustainment_row.case_id = target_case_id
  ) then
    raise exception 'sustainment item does not belong to this case'
      using errcode = '22023';
  end if;

  if target_session_id is not null and not exists (
    select 1
    from public.problem_solving_sessions session_row
    where session_row.organisation_id = org_id
      and session_row.id = target_session_id
      and session_row.case_id = target_case_id
  ) then
    raise exception 'session does not belong to this case'
      using errcode = '22023';
  end if;

  if target_session_entry_id is not null and not exists (
    select 1
    from public.problem_solving_session_entries entry_row
    join public.problem_solving_sessions session_row
      on session_row.organisation_id = entry_row.organisation_id
     and session_row.id = entry_row.session_id
    where entry_row.organisation_id = org_id
      and entry_row.id = target_session_entry_id
      and session_row.case_id = target_case_id
  ) then
    raise exception 'session entry does not belong to this case'
      using errcode = '22023';
  end if;

  if not private.attachment_is_active_in_organisation(
    case_row.organisation_id,
    target_attachment_id
  ) then
    raise exception 'attachment not found or not active'
      using errcode = 'P0002';
  end if;

  insert into public.problem_solving_evidence_links (
    organisation_id,
    problem_solving_case_id,
    attachment_id,
    current_condition_item_id,
    containment_id,
    hypothesis_id,
    hypothesis_test_id,
    countermeasure_id,
    effectiveness_check_id,
    sustainment_item_id,
    session_id,
    session_entry_id,
    is_case_level,
    link_rationale,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_attachment_id,
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_session_id,
    target_session_entry_id,
    target_is_case_level,
    nullif(btrim(target_link_rationale), ''),
    actor_membership_id
  )
  returning id into new_link_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.evidence_linked',
    target_case_id,
    'succeeded',
    jsonb_build_object('evidence_link_id', new_link_id)
  );

  return new_link_id;
end;
$$;

alter function private.link_problem_solving_evidence(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, boolean, text
) owner to lean_hub_private_owner;
