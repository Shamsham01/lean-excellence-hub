-- VIS1b: fail-closed open_action_count in get_problem_solving_list.
-- Parent Problem Solving read does not imply child Action read; count only
-- linked actions that pass private.can_read_action (canonical Action read predicate).

-- get_problem_solving_list

create or replace function public.get_problem_solving_list(
  target_search text default null,
  target_status text default null,
  target_severity text default null,
  target_unit_id uuid default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'problem solving list is not authorised'
      using errcode = '42501';
  end if;

  offset_val := greatest((target_page - 1) * target_page_size, 0);

  select count(*)
  into total_count
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and private.can_read_problem_solving_case(org_id, ps_case.id)
    and (target_status is null or ps_case.status = target_status)
    and (target_severity is null or ps_case.severity = target_severity)
    and (target_unit_id is null or ps_case.organisation_unit_id = target_unit_id)
    and (target_owner_membership_id is null or ps_case.owner_membership_id = target_owner_membership_id)
    and (
      target_facilitator_membership_id is null
      or ps_case.facilitator_membership_id = target_facilitator_membership_id
    )
    and (
      target_search is null
      or ps_case.title ilike '%' || target_search || '%'
      or ps_case.case_number ilike '%' || target_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ps_case.id,
        'case_number', ps_case.case_number,
        'title', ps_case.title,
        'status', ps_case.status,
        'severity', ps_case.severity,
        'organisation_unit_id', ps_case.organisation_unit_id,
        'owner_membership_id', ps_case.owner_membership_id,
        'facilitator_membership_id', ps_case.facilitator_membership_id,
        'current_method_stage_id', ps_case.current_method_stage_id,
        'method_version_id', ps_case.method_version_id,
        'closure_outcome', ps_case.closure_outcome,
        'hypothesis_count', (
          select count(*)
          from public.problem_solving_hypotheses h
          where h.organisation_id = org_id
            and h.problem_solving_case_id = ps_case.id
        ),
        'verified_hypothesis_count', (
          select count(*)
          from public.problem_solving_hypotheses h
          where h.organisation_id = org_id
            and h.problem_solving_case_id = ps_case.id
            and h.status = 'verified'
        ),
        'countermeasure_count', (
          select count(*)
          from public.problem_solving_countermeasures cm
          where cm.organisation_id = org_id
            and cm.problem_solving_case_id = ps_case.id
        ),
        'open_action_count', (
          select count(*)
          from public.problem_solving_action_context ac
          join public.actions a
            on a.organisation_id = ac.organisation_id
           and a.id = ac.action_id
          where ac.organisation_id = org_id
            and ac.problem_solving_case_id = ps_case.id
            and a.status in ('open', 'in_progress')
            and private.can_read_action(org_id, a.id)
        ),
        'created_at', ps_case.created_at,
        'updated_at', ps_case.updated_at,
        'closed_at', ps_case.closed_at
      )
      order by ps_case.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and private.can_read_problem_solving_case(org_id, ps_case.id)
    and (target_status is null or ps_case.status = target_status)
    and (target_severity is null or ps_case.severity = target_severity)
    and (target_unit_id is null or ps_case.organisation_unit_id = target_unit_id)
    and (target_owner_membership_id is null or ps_case.owner_membership_id = target_owner_membership_id)
    and (
      target_facilitator_membership_id is null
      or ps_case.facilitator_membership_id = target_facilitator_membership_id
    )
    and (
      target_search is null
      or ps_case.title ilike '%' || target_search || '%'
      or ps_case.case_number ilike '%' || target_search || '%'
    )
  limit target_page_size
  offset offset_val;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;
