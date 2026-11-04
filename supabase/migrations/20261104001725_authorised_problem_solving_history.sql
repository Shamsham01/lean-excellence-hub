-- Authorised historical Problem Solving search.
--
-- Extends search_similar_problem_solving_cases. Both functions use the caller's
-- session organisation and private.can_read_problem_solving_case. They do not
-- accept an organisation id, role, or permission flag. Closed cases only.
-- Unreadable candidates are omitted. The result has no hidden-match count and
-- no similarity score. plainto_tsquery treats the text as search words, not SQL.

create or replace function private.authorised_closed_problem_solving_matches(
  target_query text,
  target_exclude_case_id uuid,
  target_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  normalised_query text;
  search_query tsquery;
  effective_limit integer;
  result jsonb;
begin
  if org_id is null then
    raise exception 'problem solving history search is not authorised'
      using errcode = '42501';
  end if;

  if target_exclude_case_id is not null
    and not private.can_read_problem_solving_case(org_id, target_exclude_case_id) then
    raise exception 'problem solving history search is not authorised'
      using errcode = '42501';
  end if;

  normalised_query := left(btrim(coalesce(target_query, '')), 2000);
  if normalised_query = '' then
    return '[]'::jsonb;
  end if;

  search_query := plainto_tsquery('english', normalised_query);
  if search_query is null or pg_catalog.numnode(search_query) = 0 then
    return '[]'::jsonb;
  end if;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 20);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'case_id', ranked_case.id,
        'record_type', 'problem_solving_case',
        'title', ranked_case.title,
        'status', ranked_case.status,
        'closure_outcome', ranked_case.closure_outcome,
        'href', '/platform/problem-solving/' || ranked_case.id::text,
        'problem_statement_excerpt', ranked_case.problem_statement_excerpt,
        'verified_cause_snippets', ranked_case.verified_snippets,
        'evidence_class', ranked_case.evidence_class,
        'applicability',
          'This is a finding on a closed case you can read. It does not prove the cause of another problem.',
        'content_trust', 'untrusted_record'
      )
      order by ranked_case.search_rank desc, ranked_case.id
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
      left(coalesce(case_row.problem_statement, ''), 240) as problem_statement_excerpt,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(case_row.title, '') || ' ' || coalesce(case_row.problem_statement, '')
        ),
        search_query
      ) as search_rank,
      case
        when case_row.closure_outcome = 'resolved_verified_cause'
          then 'historical_verified_outcome'
        when case_row.closure_outcome = 'transferred'
          then 'transferred'
        else 'closed_without_verified_cause'
      end as evidence_class,
      (
        select coalesce(jsonb_agg(snippet.statement), '[]'::jsonb)
        from (
          select left(hypothesis_row.statement, 240) as statement
          from public.problem_solving_hypotheses hypothesis_row
          where hypothesis_row.organisation_id = org_id
            and hypothesis_row.problem_solving_case_id = case_row.id
            and hypothesis_row.status = 'verified'
          order by hypothesis_row.verified_at nulls last, hypothesis_row.id
          limit 3
        ) snippet
      ) as verified_snippets
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.status = 'closed'
      and (
        target_exclude_case_id is null
        or case_row.id <> target_exclude_case_id
      )
      and private.can_read_problem_solving_case(org_id, case_row.id)
      and to_tsvector(
        'english',
        coalesce(case_row.title, '') || ' ' || coalesce(case_row.problem_statement, '')
      ) @@ search_query
    order by search_rank desc, case_row.id
    limit effective_limit
  ) ranked_case;

  return result;
end;
$$;

revoke all on function private.authorised_closed_problem_solving_matches(text, uuid, integer)
  from public, anon, authenticated, service_role;

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
begin
  if org_id is null
    or not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'similar case search is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into source_case
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'similar case search is not authorised'
      using errcode = '42501';
  end if;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 20);

  return private.authorised_closed_problem_solving_matches(
    coalesce(source_case.title, '') || ' ' || coalesce(source_case.problem_statement, ''),
    target_case_id,
    effective_limit
  );
end;
$$;

create or replace function public.search_authorised_problem_solving_history(
  target_query text,
  target_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  effective_limit integer;
begin
  if private.current_organisation_id() is null then
    raise exception 'problem solving history search is not authorised'
      using errcode = '42501';
  end if;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 8);

  return private.authorised_closed_problem_solving_matches(
    target_query,
    null,
    effective_limit
  );
end;
$$;

grant execute on function public.search_similar_problem_solving_cases(uuid, integer) to authenticated;
grant execute on function public.search_authorised_problem_solving_history(text, integer) to authenticated;

revoke all on function public.search_similar_problem_solving_cases(uuid, integer)
  from public, anon, service_role;
revoke all on function public.search_authorised_problem_solving_history(text, integer)
  from public, anon, service_role;
