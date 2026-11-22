-- LEANAI-SIMILARITY-002: permission-safe related Suggestions and Actions before save.
--
-- Deterministic English lexeme search. Uses private.can_read_improvement_suggestion
-- and private.can_read_action. No organisation id parameter, no similarity score,
-- no hidden-match count. Omits drafts, withdrawn suggestions, and cancelled actions.
--
-- Ownership: SECURITY DEFINER functions stay owned by the migration role.
-- Do not ALTER OWNER to lean_hub_private_owner.

create or replace function private.authorised_improvement_suggestion_matches(
  target_query text,
  target_exclude_suggestion_id uuid,
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
  actor_membership_id uuid := private.current_membership_id(org_id);
  normalised_query text;
  query_vector tsvector;
  search_query tsquery;
  query_lexeme_count integer := 0;
  required_overlap integer;
  lexeme_text text;
  term_query tsquery;
  effective_limit integer;
  result jsonb;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_read_suggestion_submission_catalog(org_id) then
    raise exception 'improvement suggestion similarity search is not authorised'
      using errcode = '42501';
  end if;

  if target_exclude_suggestion_id is not null
    and not private.can_read_improvement_suggestion(org_id, target_exclude_suggestion_id) then
    raise exception 'improvement suggestion similarity search is not authorised'
      using errcode = '42501';
  end if;

  normalised_query := left(btrim(coalesce(target_query, '')), 2000);
  if normalised_query = '' then
    return '[]'::jsonb;
  end if;

  query_vector := to_tsvector('english', normalised_query);
  search_query := null;
  for lexeme_text in
    select query_lexeme.lexeme
    from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
  loop
    term_query := plainto_tsquery('english', lexeme_text);
    if term_query is null or pg_catalog.numnode(term_query) = 0 then
      continue;
    end if;
    query_lexeme_count := query_lexeme_count + 1;
    if search_query is null then
      search_query := term_query;
    else
      search_query := search_query || term_query;
    end if;
  end loop;

  if search_query is null or pg_catalog.numnode(search_query) = 0 then
    return '[]'::jsonb;
  end if;

  required_overlap := case
    when query_lexeme_count <= 3 then query_lexeme_count
    else 3
  end;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 20);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'suggestion_id', ranked_row.id,
        'record_type', 'improvement_suggestion',
        'title', ranked_row.title,
        'status', ranked_row.status,
        'href', '/platform/suggestions/' || ranked_row.id::text,
        'body_excerpt', ranked_row.body_excerpt,
        'applicability',
          'This is an existing suggestion you can open. Shared wording does not mean your idea is a duplicate.',
        'content_trust', 'untrusted_record'
      )
      order by ranked_row.overlap_count desc, ranked_row.search_rank desc, ranked_row.id
    ),
    '[]'::jsonb
  )
  into result
  from (
    select candidate.id,
      candidate.title,
      candidate.status,
      candidate.body_excerpt,
      candidate.search_rank,
      candidate.overlap_count
    from (
      select
        suggestion_row.id,
        suggestion_row.title,
        suggestion_row.status,
        left(
          coalesce(suggestion_row.problem_or_opportunity, '') || ' ' ||
            coalesce(suggestion_row.proposed_idea, ''),
          240
        ) as body_excerpt,
        ts_rank(
          to_tsvector(
            'english',
            coalesce(suggestion_row.title, '') || ' ' ||
              coalesce(suggestion_row.problem_or_opportunity, '') || ' ' ||
              coalesce(suggestion_row.proposed_idea, '')
          ),
          search_query
        ) as search_rank,
        (
          select count(*)::integer
          from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
          where to_tsvector(
            'english',
            coalesce(suggestion_row.title, '') || ' ' ||
              coalesce(suggestion_row.problem_or_opportunity, '') || ' ' ||
              coalesce(suggestion_row.proposed_idea, '')
          ) @@ plainto_tsquery('english', query_lexeme.lexeme)
        ) as overlap_count
      from public.improvement_suggestions suggestion_row
      where suggestion_row.organisation_id = org_id
        and suggestion_row.status not in ('draft', 'withdrawn')
        and (
          target_exclude_suggestion_id is null
          or suggestion_row.id <> target_exclude_suggestion_id
        )
        and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
        and to_tsvector(
          'english',
          coalesce(suggestion_row.title, '') || ' ' ||
            coalesce(suggestion_row.problem_or_opportunity, '') || ' ' ||
            coalesce(suggestion_row.proposed_idea, '')
        ) @@ search_query
    ) candidate
    where candidate.overlap_count >= required_overlap
    order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
    limit effective_limit
  ) ranked_row;

  return result;
end;
$$;

revoke all on function private.authorised_improvement_suggestion_matches(text, uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function private.authorised_action_matches(
  target_query text,
  target_exclude_action_id uuid,
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
  actor_membership_id uuid := private.current_membership_id(org_id);
  normalised_query text;
  query_vector tsvector;
  search_query tsquery;
  query_lexeme_count integer := 0;
  required_overlap integer;
  lexeme_text text;
  term_query tsquery;
  effective_limit integer;
  result jsonb;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action similarity search is not authorised'
      using errcode = '42501';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'actions.create', null, null)
    or private.has_scoped_permission(org_id, 'actions.read', null, null)
    or private.has_scoped_permission(
      org_id,
      'actions.read',
      actor_membership_id,
      null
    )
  ) then
    raise exception 'action similarity search is not authorised'
      using errcode = '42501';
  end if;

  if target_exclude_action_id is not null
    and not private.can_read_action(org_id, target_exclude_action_id) then
    raise exception 'action similarity search is not authorised'
      using errcode = '42501';
  end if;

  normalised_query := left(btrim(coalesce(target_query, '')), 2000);
  if normalised_query = '' then
    return '[]'::jsonb;
  end if;

  query_vector := to_tsvector('english', normalised_query);
  search_query := null;
  for lexeme_text in
    select query_lexeme.lexeme
    from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
  loop
    term_query := plainto_tsquery('english', lexeme_text);
    if term_query is null or pg_catalog.numnode(term_query) = 0 then
      continue;
    end if;
    query_lexeme_count := query_lexeme_count + 1;
    if search_query is null then
      search_query := term_query;
    else
      search_query := search_query || term_query;
    end if;
  end loop;

  if search_query is null or pg_catalog.numnode(search_query) = 0 then
    return '[]'::jsonb;
  end if;

  required_overlap := case
    when query_lexeme_count <= 3 then query_lexeme_count
    else 3
  end;

  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 20);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', ranked_row.id,
        'record_type', 'action',
        'title', ranked_row.title,
        'status', ranked_row.status,
        'href', '/platform/actions/' || ranked_row.id::text,
        'description_excerpt', ranked_row.description_excerpt,
        'applicability',
          'This is an existing action you can open. Shared wording does not mean you must use it instead of creating a new action.',
        'content_trust', 'untrusted_record'
      )
      order by ranked_row.overlap_count desc, ranked_row.search_rank desc, ranked_row.id
    ),
    '[]'::jsonb
  )
  into result
  from (
    select candidate.id,
      candidate.title,
      candidate.status,
      candidate.description_excerpt,
      candidate.search_rank,
      candidate.overlap_count
    from (
      select
        action_row.id,
        action_row.title,
        action_row.status,
        left(coalesce(action_row.description, ''), 240) as description_excerpt,
        ts_rank(
          to_tsvector(
            'english',
            coalesce(action_row.title, '') || ' ' || coalesce(action_row.description, '')
          ),
          search_query
        ) as search_rank,
        (
          select count(*)::integer
          from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
          where to_tsvector(
            'english',
            coalesce(action_row.title, '') || ' ' || coalesce(action_row.description, '')
          ) @@ plainto_tsquery('english', query_lexeme.lexeme)
        ) as overlap_count
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.status <> 'cancelled'
        and (
          target_exclude_action_id is null
          or action_row.id <> target_exclude_action_id
        )
        and private.can_read_action(org_id, action_row.id)
        and to_tsvector(
          'english',
          coalesce(action_row.title, '') || ' ' || coalesce(action_row.description, '')
        ) @@ search_query
    ) candidate
    where candidate.overlap_count >= required_overlap
    order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
    limit effective_limit
  ) ranked_row;

  return result;
end;
$$;

revoke all on function private.authorised_action_matches(text, uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function public.search_authorised_improvement_suggestions(
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
  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 8);

  return private.authorised_improvement_suggestion_matches(
    target_query,
    null,
    effective_limit
  );
end;
$$;

create or replace function public.search_authorised_actions(
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
  effective_limit := least(greatest(coalesce(target_limit, 5), 1), 8);

  return private.authorised_action_matches(
    target_query,
    null,
    effective_limit
  );
end;
$$;

grant execute on function public.search_authorised_improvement_suggestions(text, integer)
  to authenticated;
grant execute on function public.search_authorised_actions(text, integer)
  to authenticated;

revoke all on function public.search_authorised_improvement_suggestions(text, integer)
  from public, anon, service_role;
revoke all on function public.search_authorised_actions(text, integer)
  from public, anon, service_role;
