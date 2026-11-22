-- Page workplace feeds in the database and look up one record by id.
-- The previous feed capped every module query at 50 rows, and record
-- lookup reused that capped feed, so an authorised older record disappeared.

create or replace function public.member_has_grant_permission(
  target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = target_permission_key
    where grant_row.organisation_id = private.current_organisation_id()
      and grant_row.grantee_membership_id =
        private.current_membership_id(grant_row.organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
  )
$$;

drop function if exists private.workplace_module_records(uuid, text);

create or replace function private.workplace_module_records(
  target_organisation_id uuid,
  target_module text,
  target_record_id uuid default null,
  target_limit integer default null,
  target_offset integer default 0
)
returns setof jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer;
  v_offset integer;
begin
  if target_record_id is not null then
    v_limit := 1;
    v_offset := 0;
  else
    v_limit := least(greatest(coalesce(target_limit, 26), 1), 51);
    v_offset := greatest(coalesce(target_offset, 0), 0);
  end if;

  if target_module = 'maturity' then
    return query
      select combined.item
      from (
        select private.workplace_feed_item(
          result_row.id,
          coalesce(result_row.model_name_snapshot, 'Published maturity result'),
          'published',
          result_row.unit_name_snapshot,
          'Score ' || result_row.overall_score::text,
          result_row.published_at
        ) as item,
        result_row.published_at as sort_at,
        result_row.id as sort_id
        from public.maturity_official_results result_row
        where result_row.organisation_id = target_organisation_id
          and (target_record_id is null or result_row.id = target_record_id)
          and private.workplace_view_covers_unit(
            target_organisation_id,
            result_row.unit_id_snapshot
          )
        union all
        select catalogue.item, catalogue.sort_at, catalogue.sort_id
        from (
          select distinct on (model_row.id) private.workplace_feed_item(
            model_row.id,
            model_row.display_name,
            'published',
            null,
            'Published framework',
            version_row.published_at
          ) as item,
          version_row.published_at as sort_at,
          model_row.id as sort_id
          from public.maturity_models model_row
          join public.maturity_model_versions version_row
            on version_row.organisation_id = model_row.organisation_id
           and version_row.model_id = model_row.id
           and version_row.status = 'published'
          where model_row.organisation_id = target_organisation_id
            and (target_record_id is null or model_row.id = target_record_id)
          order by model_row.id, version_row.published_at desc nulls last
        ) catalogue
      ) combined
      order by combined.sort_at desc nulls last, combined.sort_id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'five_s' then
    return query
      select combined.item
      from (
        select private.workplace_feed_item(
          audit_row.id,
          coalesce(unit_row.name, 'Completed 5S audit'),
          audit_row.status,
          unit_row.name,
          case
            when audit_row.overall_score_percent is null then 'Completed audit'
            else 'Score ' || audit_row.overall_score_percent::text || '%'
          end,
          audit_row.completed_at
        ) as item,
        audit_row.completed_at as sort_at,
        audit_row.id as sort_id
        from public.five_s_audits audit_row
        left join public.organisation_units unit_row
          on unit_row.organisation_id = audit_row.organisation_id
         and unit_row.id = audit_row.unit_id
        where audit_row.organisation_id = target_organisation_id
          and audit_row.status = 'completed'
          and (target_record_id is null or audit_row.id = target_record_id)
          and private.workplace_view_covers_unit(
            target_organisation_id,
            audit_row.unit_id
          )
        union all
        select catalogue.item, catalogue.sort_at, catalogue.sort_id
        from (
          select distinct on (standard_row.id) private.workplace_feed_item(
            standard_row.id,
            standard_row.display_name,
            'published',
            null,
            'Published standard',
            version_row.published_at
          ) as item,
          version_row.published_at as sort_at,
          standard_row.id as sort_id
          from public.five_s_standards standard_row
          join public.five_s_standard_versions version_row
            on version_row.organisation_id = standard_row.organisation_id
           and version_row.standard_id = standard_row.id
           and version_row.status = 'published'
          where standard_row.organisation_id = target_organisation_id
            and (target_record_id is null or standard_row.id = target_record_id)
          order by standard_row.id, version_row.published_at desc nulls last
        ) catalogue
      ) combined
      order by combined.sort_at desc nulls last, combined.sort_id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'gemba' then
    return query
      select combined.item
      from (
        select private.workplace_feed_item(
          walk_row.id,
          coalesce(walk_row.definition_name_snapshot, 'Completed Gemba walk'),
          walk_row.status,
          coalesce(walk_row.unit_name_snapshot, unit_row.name),
          'Completed walk',
          walk_row.completed_at
        ) as item,
        walk_row.completed_at as sort_at,
        walk_row.id as sort_id
        from public.gemba_walks walk_row
        left join public.organisation_units unit_row
          on unit_row.organisation_id = walk_row.organisation_id
         and unit_row.id = walk_row.unit_id
        where walk_row.organisation_id = target_organisation_id
          and walk_row.status = 'completed'
          and (target_record_id is null or walk_row.id = target_record_id)
          and private.workplace_view_covers_unit(
            target_organisation_id,
            walk_row.unit_id
          )
        union all
        select catalogue.item, catalogue.sort_at, catalogue.sort_id
        from (
          select distinct on (definition_row.id) private.workplace_feed_item(
            definition_row.id,
            definition_row.display_name,
            'published',
            null,
            'Published walk definition',
            version_row.published_at
          ) as item,
          version_row.published_at as sort_at,
          definition_row.id as sort_id
          from public.gemba_definitions definition_row
          join public.gemba_definition_versions version_row
            on version_row.organisation_id = definition_row.organisation_id
           and version_row.definition_id = definition_row.id
           and version_row.status = 'published'
          where definition_row.organisation_id = target_organisation_id
            and (
              target_record_id is null
              or definition_row.id = target_record_id
            )
          order by definition_row.id, version_row.published_at desc nulls last
        ) catalogue
      ) combined
      order by combined.sort_at desc nulls last, combined.sort_id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'actions' then
    return query
      select private.workplace_feed_item(
        action_row.id,
        action_row.title,
        action_row.status,
        unit_row.name,
        action_row.priority,
        coalesce(action_row.completed_at, action_row.due_at, action_row.created_at)
      )
      from public.actions action_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = action_row.organisation_id
       and unit_row.id = action_row.unit_id
      where action_row.organisation_id = target_organisation_id
        and action_row.status in ('open', 'in_progress', 'completed', 'verified')
        and (target_record_id is null or action_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          action_row.unit_id
        )
      order by coalesce(
        action_row.completed_at,
        action_row.due_at,
        action_row.created_at
      ) desc, action_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'projects' then
    return query
      select private.workplace_feed_item(
        project_row.id,
        project_row.title,
        project_row.status,
        unit_row.name,
        project_row.priority,
        project_row.created_at
      )
      from public.ci_projects project_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = project_row.organisation_id
       and unit_row.id = project_row.unit_id
      where project_row.organisation_id = target_organisation_id
        and project_row.status in (
          'submitted', 'approved', 'active', 'on_hold', 'completed'
        )
        and (target_record_id is null or project_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          project_row.unit_id
        )
      order by project_row.created_at desc, project_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'benefits' then
    return query
      select private.workplace_feed_item(
        benefit_row.id,
        benefit_row.title,
        benefit_row.status,
        unit_row.name,
        case
          when benefit_row.benefit_class = 'financial'
            then 'Financial amounts are not included in viewing access'
          else coalesce(benefit_row.non_financial_type, 'Non-financial')
        end,
        benefit_row.created_at
      )
      from public.improvement_benefits benefit_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = benefit_row.organisation_id
       and unit_row.id = benefit_row.site_unit_id
      where benefit_row.organisation_id = target_organisation_id
        and benefit_row.status in ('approved', 'realising', 'realised')
        and (target_record_id is null or benefit_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          coalesce(benefit_row.site_unit_id, benefit_row.organisational_unit_id)
        )
      order by benefit_row.created_at desc, benefit_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'problem_solving' then
    return query
      select private.workplace_feed_item(
        case_row.id,
        case_row.title,
        case_row.status,
        unit_row.name,
        'Shared case',
        coalesce(case_row.closed_at, case_row.activated_at, case_row.created_at)
      )
      from public.problem_solving_cases case_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = case_row.organisation_id
       and unit_row.id = case_row.organisation_unit_id
      where case_row.organisation_id = target_organisation_id
        and case_row.status in ('active', 'closed')
        and (target_record_id is null or case_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          case_row.organisation_unit_id
        )
      order by coalesce(
        case_row.closed_at,
        case_row.activated_at,
        case_row.created_at
      ) desc, case_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'suggestions' then
    return query
      select private.workplace_feed_item(
        suggestion_row.id,
        suggestion_row.title,
        suggestion_row.status,
        unit_row.name,
        'Shared suggestion',
        suggestion_row.created_at
      )
      from public.improvement_suggestions suggestion_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = suggestion_row.organisation_id
       and unit_row.id = suggestion_row.origin_unit_id
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.status in (
          'submitted', 'under_review', 'accepted', 'implementing',
          'implemented', 'parked', 'rejected'
        )
        and (target_record_id is null or suggestion_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          suggestion_row.origin_unit_id
        )
      order by suggestion_row.created_at desc, suggestion_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'recognition' then
    return query
      select private.workplace_feed_item(
        award_row.id,
        award_row.title,
        award_row.status,
        unit_row.name,
        left(award_row.message, 160),
        award_row.awarded_at
      )
      from public.recognition_awards award_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = award_row.organisation_id
       and unit_row.id = award_row.organisational_unit_id
      where award_row.organisation_id = target_organisation_id
        and award_row.status = 'active'
        and award_row.visibility in ('unit', 'organisation')
        and (target_record_id is null or award_row.id = target_record_id)
        and private.workplace_view_covers_unit(
          target_organisation_id,
          award_row.organisational_unit_id
        )
      order by award_row.awarded_at desc, award_row.id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'skills' then
    return query
      select private.workplace_feed_item(
        skill_row.id,
        skill_row.name,
        skill_row.status,
        null,
        coalesce(skill_row.category, skill_row.code),
        skill_row.updated_at
      )
      from public.skills skill_row
      where skill_row.organisation_id = target_organisation_id
        and skill_row.status = 'active'
        and (target_record_id is null or skill_row.id = target_record_id)
      order by skill_row.name, skill_row.id
      limit v_limit
      offset v_offset;
    return;
  end if;

  if target_module = 'training' then
    return query
      select combined.item
      from (
        select private.workplace_feed_item(
          course_row.id,
          course_row.name,
          course_row.status,
          null,
          course_row.code,
          course_row.created_at
        ) as item,
        course_row.created_at as sort_at,
        course_row.id as sort_id
        from public.training_courses course_row
        where course_row.organisation_id = target_organisation_id
          and course_row.status = 'active'
          and (target_record_id is null or course_row.id = target_record_id)
        union all
        select private.workplace_feed_item(
          completion_row.id,
          coalesce(course_row.name, 'Completed course'),
          completion_row.status,
          null,
          'Your completed course',
          completion_row.completed_at
        ),
        completion_row.completed_at,
        completion_row.id
        from public.training_completions completion_row
        join public.training_courses course_row
          on course_row.organisation_id = completion_row.organisation_id
         and course_row.id = completion_row.course_id
        where completion_row.organisation_id = target_organisation_id
          and completion_row.membership_id = private.current_membership_id(
            target_organisation_id
          )
          and completion_row.status = 'completed'
          and (
            target_record_id is null
            or completion_row.id = target_record_id
          )
      ) combined
      order by combined.sort_at desc nulls last, combined.sort_id desc
      limit v_limit
      offset v_offset;
    return;
  end if;

  raise exception 'workplace module is not available'
    using errcode = '22023';
end;
$$;

drop function if exists public.get_workplace_feed(text);

create or replace function public.get_workplace_feed(
  target_module text,
  target_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  page_size constant integer := 25;
  page_number integer;
  records jsonb;
  has_more boolean := false;
begin
  if org_id is null
    or not private.member_has_any_workplace_view(org_id) then
    raise exception 'workplace view is not authorised'
      using errcode = '42501';
  end if;

  page_number := least(greatest(coalesce(target_page, 1), 1), 100000);

  select coalesce(
    jsonb_agg(listing.record_row order by listing.ordinality),
    '[]'::jsonb
  )
  into records
  from private.workplace_module_records(
    org_id,
    target_module,
    null,
    page_size + 1,
    (page_number - 1) * page_size
  ) with ordinality as listing(record_row, ordinality);

  if jsonb_array_length(records) > page_size then
    has_more := true;
    records := records - (jsonb_array_length(records) - 1);
  end if;

  return jsonb_build_object(
    'module', target_module,
    'records', records,
    'page', page_number,
    'page_size', page_size,
    'has_more', has_more
  );
end;
$$;

create or replace function public.get_workplace_record(
  target_module text,
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
  record_row jsonb;
begin
  if org_id is null
    or not private.member_has_any_workplace_view(org_id) then
    raise exception 'workplace view is not authorised'
      using errcode = '42501';
  end if;

  select feed_row
  into record_row
  from private.workplace_module_records(
    org_id,
    target_module,
    target_record_id,
    1,
    0
  ) feed_row
  limit 1;

  return record_row;
end;
$$;

alter function public.member_has_grant_permission(text) owner to postgres;
alter function private.workplace_module_records(uuid, text, uuid, integer, integer)
  owner to postgres;
alter function public.get_workplace_feed(text, integer) owner to postgres;
alter function public.get_workplace_record(text, uuid) owner to postgres;

revoke all on function public.member_has_grant_permission(text)
  from public, anon;
revoke all on function private.workplace_module_records(uuid, text, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_workplace_feed(text, integer) from public, anon;
revoke all on function public.get_workplace_record(text, uuid) from public, anon;

grant execute on function public.member_has_grant_permission(text) to authenticated;
grant execute on function public.get_workplace_feed(text, integer) to authenticated;
grant execute on function public.get_workplace_record(text, uuid) to authenticated;
