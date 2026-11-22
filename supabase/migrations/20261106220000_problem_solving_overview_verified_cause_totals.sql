-- Problem solving overview: expose total verified causes (hypotheses) alongside
-- case counts so portfolio metrics align with per-case hypothesis counts.

create or replace function public.get_problem_solving_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  result jsonb;
begin
  if org_id is null then
    raise exception 'problem solving overview is not authorised'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'status_pipeline', jsonb_build_object(
      'draft', count(*) filter (where ps_case.status = 'draft'),
      'active', count(*) filter (where ps_case.status = 'active'),
      'closed', count(*) filter (where ps_case.status = 'closed'),
      'cancelled', count(*) filter (where ps_case.status = 'cancelled')
    ),
    'severity_breakdown', jsonb_build_object(
      'critical', count(*) filter (
        where ps_case.severity = 'critical'
          and ps_case.status in ('draft', 'active')
      ),
      'major', count(*) filter (
        where ps_case.severity = 'major'
          and ps_case.status in ('draft', 'active')
      ),
      'moderate', count(*) filter (
        where ps_case.severity = 'moderate'
          and ps_case.status in ('draft', 'active')
      ),
      'minor', count(*) filter (
        where ps_case.severity = 'minor'
          and ps_case.status in ('draft', 'active')
      )
    ),
    'active_cases', count(*) filter (where ps_case.status in ('draft', 'active')),
    'total_cases', count(*),
    'cases_with_verified_causes', count(*) filter (
      where exists (
        select 1
        from public.problem_solving_hypotheses h
        where h.organisation_id = org_id
          and h.problem_solving_case_id = ps_case.id
          and h.status = 'verified'
      )
    ),
    'verified_cause_count', coalesce((
      select count(*)::bigint
      from public.problem_solving_hypotheses h
      where h.organisation_id = org_id
        and h.status = 'verified'
        and exists (
          select 1
          from public.problem_solving_cases readable
          where readable.organisation_id = org_id
            and readable.id = h.problem_solving_case_id
            and private.can_read_problem_solving_case(org_id, readable.id)
        )
    ), 0::bigint),
    'cases_with_effective_countermeasures', count(*) filter (
      where exists (
        select 1
        from public.problem_solving_countermeasures cm
        where cm.organisation_id = org_id
          and cm.problem_solving_case_id = ps_case.id
          and cm.status = 'effective'
      )
    )
  )
  into result
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and private.can_read_problem_solving_case(org_id, ps_case.id);

  return coalesce(result, '{}'::jsonb);
end;
$$;
