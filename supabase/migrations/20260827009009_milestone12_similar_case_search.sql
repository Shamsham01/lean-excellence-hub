-- Milestone 12: permission-aware similar problem solving case search.

create or replace function public.search_similar_problem_solving_cases(
  target_case_id uuid,
  target_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  source_case public.problem_solving_cases%rowtype;
  effective_limit integer;
  search_query tsquery;
  result jsonb;
begin
  if org_id is null then
    raise exception 'similar case search is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'similar case search is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into source_case
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 20);

  search_query := plainto_tsquery(
    'english',
    coalesce(source_case.title, '') || ' ' || coalesce(source_case.problem_statement, '')
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'case_id', ranked_case.id,
        'title', ranked_case.title,
        'status', ranked_case.status,
        'closure_outcome', ranked_case.closure_outcome,
        'rank', ranked_case.search_rank,
        'verified_cause_snippets', ranked_case.verified_snippets
      )
      order by ranked_case.search_rank desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      case_row.id,
      case_row.title,
      case_row.status,
      case_row.closure_outcome,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(case_row.title, '') || ' ' || coalesce(case_row.problem_statement, '')
        ),
        search_query
      ) as search_rank,
      (
        select coalesce(
          jsonb_agg(hypothesis_row.statement order by hypothesis_row.verified_at),
          '[]'::jsonb
        )
        from public.problem_solving_hypotheses hypothesis_row
        where hypothesis_row.organisation_id = org_id
          and hypothesis_row.problem_solving_case_id = case_row.id
          and hypothesis_row.status = 'verified'
      ) as verified_snippets
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id <> target_case_id
      and case_row.status = 'closed'
      and private.can_read_problem_solving_case(org_id, case_row.id)
      and to_tsvector(
        'english',
        coalesce(case_row.title, '') || ' ' || coalesce(case_row.problem_statement, '')
      ) @@ search_query
    order by search_rank desc
    limit effective_limit
  ) ranked_case;

  return result;
end;
$$;

grant execute on function public.search_similar_problem_solving_cases(uuid, integer) to authenticated;
revoke all on function public.search_similar_problem_solving_cases(uuid, integer) from public, anon;
