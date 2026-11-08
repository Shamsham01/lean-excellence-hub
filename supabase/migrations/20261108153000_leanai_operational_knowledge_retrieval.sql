-- LEANAI-RETRIEVAL-003: cross-module operational knowledge search facade.
--
-- Permission-safe English lexeme search across operational modules for LeanAI.
-- Uses the caller session organisation, per-record can_read_* checks, and
-- private.can_use_ai on the public entrypoints. No similarity score, overlap
-- count, or hidden-match total in client-facing JSON.
--
-- Ownership: SECURITY DEFINER functions stay owned by the migration role.
-- Do not ALTER OWNER to lean_hub_private_owner.

-- ---------------------------------------------------------------------------
-- Shared lexical query preparation
-- ---------------------------------------------------------------------------

create or replace function private.leanai_prepare_lexical_query(
  target_query text,
  out normalised_query text,
  out query_vector tsvector,
  out search_query tsquery,
  out query_lexeme_count integer,
  out required_overlap integer
)
returns record
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lexeme_text text;
  term_query tsquery;
begin
  normalised_query := left(btrim(coalesce(target_query, '')), 2000);
  query_vector := null;
  search_query := null;
  query_lexeme_count := 0;
  required_overlap := 0;

  if normalised_query = '' then
  -- Caller treats null search_query as empty recall.
    return;
  end if;

  query_vector := to_tsvector('english', normalised_query);
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
    search_query := null;
    query_lexeme_count := 0;
    required_overlap := 0;
    return;
  end if;

  required_overlap := case
    when query_lexeme_count <= 3 then query_lexeme_count
    else 3
  end;
end;
$$;

revoke all on function private.leanai_prepare_lexical_query(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Per-module authorised operational search (modules not covered elsewhere)
-- ---------------------------------------------------------------------------

create or replace function private.authorised_operational_module_matches(
  target_module text,
  target_query text,
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
  query_vector tsvector;
  search_query tsquery;
  query_lexeme_count integer;
  required_overlap integer;
  effective_limit integer;
  module_key text := btrim(coalesce(target_module, ''));
  result jsonb;
begin
  if org_id is null then
    raise exception 'operational knowledge search is not authorised'
      using errcode = '42501';
  end if;

  select *
  into normalised_query,
    query_vector,
    search_query,
    query_lexeme_count,
    required_overlap
  from private.leanai_prepare_lexical_query(target_query);

  if search_query is null then
    return '[]'::jsonb;
  end if;

  effective_limit := least(greatest(coalesce(target_limit, 3), 1), 20);

  if module_key = 'ci_project' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'project_id', ranked_row.id,
          'record_type', 'ci_project',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/projects/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a CI project you can open. Shared wording does not mean the same root cause or scope.',
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
          project_row.id,
          project_row.title,
          project_row.status,
          left(
            coalesce(project_row.problem_statement, '') || ' ' ||
              coalesce(project_row.objective, '') || ' ' ||
              coalesce(project_row.expected_impact_summary, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(project_row.title, '') || ' ' ||
                coalesce(project_row.problem_statement, '') || ' ' ||
                coalesce(project_row.objective, '') || ' ' ||
                coalesce(project_row.expected_impact_summary, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(project_row.title, '') || ' ' ||
                coalesce(project_row.problem_statement, '') || ' ' ||
                coalesce(project_row.objective, '') || ' ' ||
                coalesce(project_row.expected_impact_summary, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.ci_projects project_row
        where project_row.organisation_id = org_id
          and project_row.status not in ('draft', 'cancelled')
          and private.can_read_ci_project(org_id, project_row.id)
          and to_tsvector(
            'english',
            coalesce(project_row.title, '') || ' ' ||
              coalesce(project_row.problem_statement, '') || ' ' ||
              coalesce(project_row.objective, '') || ' ' ||
              coalesce(project_row.expected_impact_summary, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'improvement_benefit' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'benefit_id', ranked_row.id,
          'record_type', 'improvement_benefit',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/benefits/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a benefit record you can open. Wording overlap is not a forecast or validation outcome.',
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
          benefit_row.id,
          benefit_row.title,
          benefit_row.status,
          left(
            coalesce(benefit_row.description, '') || ' ' ||
              coalesce(benefit_row.baseline_description, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(benefit_row.title, '') || ' ' ||
                coalesce(benefit_row.description, '') || ' ' ||
                coalesce(benefit_row.baseline_description, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(benefit_row.title, '') || ' ' ||
                coalesce(benefit_row.description, '') || ' ' ||
                coalesce(benefit_row.baseline_description, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.improvement_benefits benefit_row
        where benefit_row.organisation_id = org_id
          and benefit_row.status not in ('draft', 'rejected', 'cancelled', 'withdrawn')
          and private.can_read_improvement_benefit(org_id, benefit_row.id)
          and to_tsvector(
            'english',
            coalesce(benefit_row.title, '') || ' ' ||
              coalesce(benefit_row.description, '') || ' ' ||
              coalesce(benefit_row.baseline_description, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'gemba_walk' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'walk_id', ranked_row.id,
          'record_type', 'gemba_walk',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/gemba/walks/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a gemba walk you can open. Observations from another walk may not apply to your unit.',
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
          walk_row.id,
          coalesce(walk_row.definition_name_snapshot, 'Gemba walk') as title,
          walk_row.status,
          left(
            coalesce(walk_row.summary_notes, '') || ' ' ||
              coalesce(walk_row.unit_name_snapshot, '') || ' ' ||
              coalesce(walk_row.unit_code_snapshot, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(walk_row.definition_name_snapshot, '') || ' ' ||
                coalesce(walk_row.summary_notes, '') || ' ' ||
                coalesce(walk_row.unit_name_snapshot, '') || ' ' ||
                coalesce(walk_row.unit_code_snapshot, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(walk_row.definition_name_snapshot, '') || ' ' ||
                coalesce(walk_row.summary_notes, '') || ' ' ||
                coalesce(walk_row.unit_name_snapshot, '') || ' ' ||
                coalesce(walk_row.unit_code_snapshot, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.gemba_walks walk_row
        where walk_row.organisation_id = org_id
          and walk_row.status not in ('draft', 'cancelled')
          and private.can_read_gemba_walk(org_id, walk_row.id)
          and to_tsvector(
            'english',
            coalesce(walk_row.definition_name_snapshot, '') || ' ' ||
              coalesce(walk_row.summary_notes, '') || ' ' ||
              coalesce(walk_row.unit_name_snapshot, '') || ' ' ||
              coalesce(walk_row.unit_code_snapshot, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'five_s_audit' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'audit_id', ranked_row.id,
          'record_type', 'five_s_audit',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/5s/audits/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a 5S audit you can open. Scores and findings from another audit are not current state.',
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
          audit_row.id,
          coalesce(audit_row.standard_name_snapshot, '5S audit') as title,
          audit_row.status,
          left(
            coalesce(audit_row.standard_name_snapshot, '') || ' ' ||
              coalesce(audit_row.unit_name_snapshot, '') || ' ' ||
              coalesce(audit_row.unit_code_snapshot, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(audit_row.standard_name_snapshot, '') || ' ' ||
                coalesce(audit_row.unit_name_snapshot, '') || ' ' ||
                coalesce(audit_row.unit_code_snapshot, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(audit_row.standard_name_snapshot, '') || ' ' ||
                coalesce(audit_row.unit_name_snapshot, '') || ' ' ||
                coalesce(audit_row.unit_code_snapshot, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.five_s_audits audit_row
        where audit_row.organisation_id = org_id
          and audit_row.status not in ('draft', 'cancelled')
          and private.can_read_five_s_audit(org_id, audit_row.id)
          and to_tsvector(
            'english',
            coalesce(audit_row.standard_name_snapshot, '') || ' ' ||
              coalesce(audit_row.unit_name_snapshot, '') || ' ' ||
              coalesce(audit_row.unit_code_snapshot, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'maturity_assessment' then
    if not private.can_read_maturity_catalog(org_id) then
      return '[]'::jsonb;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'assessment_id', ranked_row.id,
          'record_type', 'maturity_assessment',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/maturity/assessments/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a maturity assessment you can open. Maturity scores are point-in-time, not benchmarks for unrelated units.',
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
          assessment_row.id,
          coalesce(model_row.display_name, 'Maturity assessment') as title,
          assessment_row.status,
          left(
            coalesce(model_row.display_name, '') || ' ' ||
              coalesce(model_row.description, '') || ' ' ||
              coalesce(assessment_row.assessment_type, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(model_row.display_name, '') || ' ' ||
                coalesce(model_row.description, '') || ' ' ||
                coalesce(assessment_row.assessment_type, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(model_row.display_name, '') || ' ' ||
                coalesce(model_row.description, '') || ' ' ||
                coalesce(assessment_row.assessment_type, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.maturity_assessments assessment_row
        join public.maturity_model_versions model_version
          on model_version.organisation_id = assessment_row.organisation_id
          and model_version.id = assessment_row.model_version_id
        join public.maturity_models model_row
          on model_row.organisation_id = model_version.organisation_id
          and model_row.id = model_version.model_id
        where assessment_row.organisation_id = org_id
          and assessment_row.status not in ('draft', 'cancelled')
          and private.can_read_maturity_assessment(org_id, assessment_row.id)
          and to_tsvector(
            'english',
            coalesce(model_row.display_name, '') || ' ' ||
              coalesce(model_row.description, '') || ' ' ||
              coalesce(assessment_row.assessment_type, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'skill' then
    if not private.can_read_skills_catalog(org_id) then
      return '[]'::jsonb;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'skill_id', ranked_row.id,
          'record_type', 'skill',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/skills/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a skill definition you can open. Required proficiency for a role may differ.',
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
          skill_row.id,
          skill_row.name as title,
          skill_row.status,
          left(
            coalesce(skill_row.description, '') || ' ' ||
              coalesce(skill_row.category, '') || ' ' ||
              coalesce(skill_row.code, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(skill_row.name, '') || ' ' ||
                coalesce(skill_row.code, '') || ' ' ||
                coalesce(skill_row.category, '') || ' ' ||
                coalesce(skill_row.description, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(skill_row.name, '') || ' ' ||
                coalesce(skill_row.code, '') || ' ' ||
                coalesce(skill_row.category, '') || ' ' ||
                coalesce(skill_row.description, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.skills skill_row
        where skill_row.organisation_id = org_id
          and skill_row.status = 'active'
          and to_tsvector(
            'english',
            coalesce(skill_row.name, '') || ' ' ||
              coalesce(skill_row.code, '') || ' ' ||
              coalesce(skill_row.category, '') || ' ' ||
              coalesce(skill_row.description, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  elsif module_key = 'training_course' then
    if not private.can_read_training_catalog(org_id) then
      return '[]'::jsonb;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'course_id', ranked_row.id,
          'record_type', 'training_course',
          'title', ranked_row.title,
          'status', ranked_row.status,
          'href', '/platform/training/courses/' || ranked_row.id::text,
          'description_excerpt', ranked_row.description_excerpt,
          'applicability',
            'This is a training course you can open. Completion elsewhere does not replace local requirements.',
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
          course_row.id,
          course_row.name as title,
          course_row.status,
          left(
            coalesce(course_row.description, '') || ' ' ||
              coalesce(course_row.category, '') || ' ' ||
              coalesce(course_row.code, ''),
            240
          ) as description_excerpt,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(course_row.name, '') || ' ' ||
                coalesce(course_row.code, '') || ' ' ||
                coalesce(course_row.category, '') || ' ' ||
                coalesce(course_row.description, '')
            ),
            search_query
          ) as search_rank,
          (
            select count(*)::integer
            from unnest(query_vector) as query_lexeme(lexeme, positions, weights)
            where to_tsvector(
              'english',
              coalesce(course_row.name, '') || ' ' ||
                coalesce(course_row.code, '') || ' ' ||
                coalesce(course_row.category, '') || ' ' ||
                coalesce(course_row.description, '')
            ) @@ plainto_tsquery('english', query_lexeme.lexeme)
          ) as overlap_count
        from public.training_courses course_row
        where course_row.organisation_id = org_id
          and course_row.status = 'active'
          and to_tsvector(
            'english',
            coalesce(course_row.name, '') || ' ' ||
              coalesce(course_row.code, '') || ' ' ||
              coalesce(course_row.category, '') || ' ' ||
              coalesce(course_row.description, '')
          ) @@ search_query
      ) candidate
      where candidate.overlap_count >= required_overlap
      order by candidate.overlap_count desc, candidate.search_rank desc, candidate.id
      limit effective_limit
    ) ranked_row;

  else
    raise exception 'unknown operational knowledge domain'
      using errcode = '22023';
  end if;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function private.authorised_operational_module_matches(text, text, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Normalise module-specific hit shapes for LeanAI consumption
-- ---------------------------------------------------------------------------

create or replace function private.leanai_normalise_operational_hits(
  target_module text,
  raw_hits jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  module_key text := btrim(coalesce(target_module, ''));
  hit_row jsonb;
  record_id uuid;
  record_type text;
  title text;
  status text;
  href text;
  excerpt text;
  applicability text;
  content_trust text;
  detail jsonb;
  merged jsonb := '[]'::jsonb;
begin
  if raw_hits is null or jsonb_typeof(raw_hits) <> 'array' then
    return '[]'::jsonb;
  end if;

  for hit_row in
    select value
    from jsonb_array_elements(raw_hits) as element(value)
  loop
    detail := '{}'::jsonb;
    excerpt := null;

    if module_key = 'problem_solving_case' then
      record_id := (hit_row ->> 'case_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'problem_solving_case');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'problem_statement_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');
      detail := jsonb_build_object(
        'closure_outcome', hit_row ->> 'closure_outcome',
        'evidence_class', hit_row ->> 'evidence_class',
        'verified_cause_snippets',
          coalesce(hit_row -> 'verified_cause_snippets', '[]'::jsonb)
      );

    elsif module_key = 'improvement_suggestion' then
      record_id := (hit_row ->> 'suggestion_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'improvement_suggestion');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'body_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'action' then
      record_id := (hit_row ->> 'action_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'action');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'ci_project' then
      record_id := (hit_row ->> 'project_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'ci_project');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'improvement_benefit' then
      record_id := (hit_row ->> 'benefit_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'improvement_benefit');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'gemba_walk' then
      record_id := (hit_row ->> 'walk_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'gemba_walk');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'five_s_audit' then
      record_id := (hit_row ->> 'audit_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'five_s_audit');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'maturity_assessment' then
      record_id := (hit_row ->> 'assessment_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'maturity_assessment');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'skill' then
      record_id := (hit_row ->> 'skill_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'skill');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    elsif module_key = 'training_course' then
      record_id := (hit_row ->> 'course_id')::uuid;
      record_type := coalesce(hit_row ->> 'record_type', 'training_course');
      title := hit_row ->> 'title';
      status := hit_row ->> 'status';
      href := hit_row ->> 'href';
      excerpt := left(coalesce(hit_row ->> 'description_excerpt', ''), 400);
      applicability := hit_row ->> 'applicability';
      content_trust := coalesce(hit_row ->> 'content_trust', 'untrusted_record');

    else
      continue;
    end if;

    if record_id is null then
      continue;
    end if;

    merged := merged || jsonb_build_array(
      jsonb_build_object(
        'record_id', record_id,
        'record_type', record_type,
        'title', title,
        'status', status,
        'href', href,
        'excerpt', excerpt,
        'applicability', applicability,
        'content_trust', content_trust,
        'detail', coalesce(detail, '{}'::jsonb)
      )
    );
  end loop;

  return merged;
end;
$$;

revoke all on function private.leanai_normalise_operational_hits(text, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public cross-module search facade
-- ---------------------------------------------------------------------------

create or replace function public.search_authorised_operational_knowledge(
  target_query text,
  target_limit integer default 8,
  target_domains text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  allowed_domains constant text[] := array[
    'problem_solving_case',
    'improvement_suggestion',
    'action',
    'gemba_walk',
    'five_s_audit',
    'maturity_assessment',
    'ci_project',
    'improvement_benefit',
    'skill',
    'training_course'
  ];
  module_to_operational_key constant jsonb := jsonb_build_object(
    'gemba_walk', 'gemba_walk',
    'five_s_audit', 'five_s_audit',
    'maturity_assessment', 'maturity_assessment',
    'ci_project', 'ci_project',
    'improvement_benefit', 'improvement_benefit',
    'skill', 'skill',
    'training_course', 'training_course'
  );
  domain_list text[];
  domain_key text;
  raw_hits jsonb;
  normalised_hits jsonb;
  merged_hits jsonb := '[]'::jsonb;
  effective_limit integer;
  per_domain_limit integer := 3;
  idx integer;
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null then
    raise exception 'operational knowledge search is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_use_ai(org_id) then
    raise exception 'operational knowledge search is not authorised'
      using errcode = '42501';
  end if;

  effective_limit := least(greatest(coalesce(target_limit, 8), 1), 12);

  if target_domains is null then
    domain_list := allowed_domains;
  else
    domain_list := array[]::text[];
    foreach domain_key in array target_domains
    loop
      if not domain_key = any (allowed_domains) then
        raise exception 'unknown operational knowledge domain'
          using errcode = '22023';
      end if;
      if not domain_key = any (domain_list) then
        domain_list := domain_list || domain_key;
      end if;
    end loop;
  end if;

  if coalesce(array_length(domain_list, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  for idx in 1..coalesce(array_length(domain_list, 1), 0)
  loop
    domain_key := domain_list[idx];

    if domain_key = 'problem_solving_case' then
      raw_hits := private.authorised_closed_problem_solving_matches(
        target_query,
        null,
        per_domain_limit
      );
    elsif domain_key = 'improvement_suggestion' then
      if private.can_read_suggestion_submission_catalog(org_id) then
        raw_hits := private.authorised_improvement_suggestion_matches(
          target_query,
          null,
          per_domain_limit
        );
      else
        raw_hits := '[]'::jsonb;
      end if;
    elsif domain_key = 'action' then
      if actor_membership_id is not null
        and (
          private.has_scoped_permission(org_id, 'actions.create', null, null)
          or private.has_scoped_permission(org_id, 'actions.read', null, null)
          or private.has_scoped_permission(
            org_id,
            'actions.read',
            actor_membership_id,
            null
          )
        ) then
        raw_hits := private.authorised_action_matches(
          target_query,
          null,
          per_domain_limit
        );
      else
        raw_hits := '[]'::jsonb;
      end if;
    elsif module_to_operational_key ? domain_key then
      raw_hits := private.authorised_operational_module_matches(
        domain_key,
        target_query,
        per_domain_limit
      );
    else
      raw_hits := '[]'::jsonb;
    end if;

    normalised_hits := private.leanai_normalise_operational_hits(domain_key, raw_hits);
    merged_hits := merged_hits || coalesce(normalised_hits, '[]'::jsonb);
  end loop;

  if jsonb_array_length(merged_hits) > effective_limit then
    select coalesce(jsonb_agg(slice_hit.value), '[]'::jsonb)
    into merged_hits
    from (
      select element.value
      from jsonb_array_elements(merged_hits) with ordinality as element(value, ord)
      where element.ord <= effective_limit
    ) slice_hit;
  end if;

  return coalesce(merged_hits, '[]'::jsonb);
end;
$$;

grant execute on function public.search_authorised_operational_knowledge(text, integer, text[])
  to authenticated;

revoke all on function public.search_authorised_operational_knowledge(text, integer, text[])
  from public, anon, service_role;

-- ---------------------------------------------------------------------------
-- Bounded record context for a single hit
-- ---------------------------------------------------------------------------

create or replace function public.get_authorised_operational_record_context(
  target_record_type text,
  target_record_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  record_type_key text := btrim(coalesce(target_record_type, ''));
  title text;
  status text;
  href text;
  excerpt text;
  content_trust text := 'untrusted_record';
begin
  if org_id is null or target_record_id is null or record_type_key = '' then
    raise exception 'operational record context is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_use_ai(org_id) then
    raise exception 'operational record context is not authorised'
      using errcode = '42501';
  end if;

  if record_type_key = 'problem_solving_case' then
    if not private.can_read_problem_solving_case(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select case_row.title,
      case_row.status,
      '/platform/problem-solving/' || case_row.id::text,
      left(coalesce(case_row.problem_statement, ''), 400)
    into title, status, href, excerpt
    from public.problem_solving_cases case_row
    where case_row.organisation_id = org_id
      and case_row.id = target_record_id;

  elsif record_type_key = 'improvement_suggestion' then
    if not private.can_read_improvement_suggestion(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select suggestion_row.title,
      suggestion_row.status,
      '/platform/suggestions/' || suggestion_row.id::text,
      left(
        coalesce(suggestion_row.problem_or_opportunity, '') || ' ' ||
          coalesce(suggestion_row.proposed_idea, ''),
        400
      )
    into title, status, href, excerpt
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = org_id
      and suggestion_row.id = target_record_id;

  elsif record_type_key = 'action' then
    if not private.can_read_action(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select action_row.title,
      action_row.status,
      '/platform/actions/' || action_row.id::text,
      left(coalesce(action_row.description, ''), 400)
    into title, status, href, excerpt
    from public.actions action_row
    where action_row.organisation_id = org_id
      and action_row.id = target_record_id;

  elsif record_type_key = 'ci_project' then
    if not private.can_read_ci_project(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select project_row.title,
      project_row.status,
      '/platform/projects/' || project_row.id::text,
      left(
        coalesce(project_row.problem_statement, '') || ' ' ||
          coalesce(project_row.objective, ''),
        400
      )
    into title, status, href, excerpt
    from public.ci_projects project_row
    where project_row.organisation_id = org_id
      and project_row.id = target_record_id;

  elsif record_type_key = 'improvement_benefit' then
    if not private.can_read_improvement_benefit(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select benefit_row.title,
      benefit_row.status,
      '/platform/benefits/' || benefit_row.id::text,
      left(coalesce(benefit_row.description, ''), 400)
    into title, status, href, excerpt
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = org_id
      and benefit_row.id = target_record_id;

  elsif record_type_key = 'gemba_walk' then
    if not private.can_read_gemba_walk(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select coalesce(walk_row.definition_name_snapshot, 'Gemba walk'),
      walk_row.status,
      '/platform/gemba/walks/' || walk_row.id::text,
      left(coalesce(walk_row.summary_notes, ''), 400)
    into title, status, href, excerpt
    from public.gemba_walks walk_row
    where walk_row.organisation_id = org_id
      and walk_row.id = target_record_id;

  elsif record_type_key = 'five_s_audit' then
    if not private.can_read_five_s_audit(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select coalesce(audit_row.standard_name_snapshot, '5S audit'),
      audit_row.status,
      '/platform/5s/audits/' || audit_row.id::text,
      left(
        coalesce(audit_row.standard_name_snapshot, '') || ' ' ||
          coalesce(audit_row.unit_name_snapshot, ''),
        400
      )
    into title, status, href, excerpt
    from public.five_s_audits audit_row
    where audit_row.organisation_id = org_id
      and audit_row.id = target_record_id;

  elsif record_type_key = 'maturity_assessment' then
    if not private.can_read_maturity_assessment(org_id, target_record_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select coalesce(model_row.display_name, 'Maturity assessment'),
      assessment_row.status,
      '/platform/maturity/assessments/' || assessment_row.id::text,
      left(coalesce(model_row.description, ''), 400)
    into title, status, href, excerpt
    from public.maturity_assessments assessment_row
    join public.maturity_model_versions model_version
      on model_version.organisation_id = assessment_row.organisation_id
      and model_version.id = assessment_row.model_version_id
    join public.maturity_models model_row
      on model_row.organisation_id = model_version.organisation_id
      and model_row.id = model_version.model_id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_record_id;

  elsif record_type_key = 'skill' then
    if not private.can_read_skills_catalog(org_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select skill_row.name,
      skill_row.status,
      '/platform/skills/' || skill_row.id::text,
      left(coalesce(skill_row.description, ''), 400)
    into title, status, href, excerpt
    from public.skills skill_row
    where skill_row.organisation_id = org_id
      and skill_row.id = target_record_id
      and skill_row.status = 'active';

  elsif record_type_key = 'training_course' then
    if not private.can_read_training_catalog(org_id) then
      raise exception 'operational record context is not authorised'
        using errcode = '42501';
    end if;

    select course_row.name,
      course_row.status,
      '/platform/training/courses/' || course_row.id::text,
      left(coalesce(course_row.description, ''), 400)
    into title, status, href, excerpt
    from public.training_courses course_row
    where course_row.organisation_id = org_id
      and course_row.id = target_record_id
      and course_row.status = 'active';

  else
    raise exception 'unknown operational record type'
      using errcode = '22023';
  end if;

  if title is null then
    raise exception 'operational record context is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'record_id', target_record_id,
    'record_type', record_type_key,
    'title', title,
    'status', status,
    'href', href,
    'excerpt', excerpt,
    'content_trust', content_trust
  );
end;
$$;

grant execute on function public.get_authorised_operational_record_context(text, uuid)
  to authenticated;

revoke all on function public.get_authorised_operational_record_context(text, uuid)
  from public, anon, service_role;
