-- PERF-001: Suggestions listing/overview. Keep PostgREST contracts and
-- can_read_improvement_suggestion semantics. Evaluate actor coverage once,
-- then filter with set membership instead of per-row permission probes.
-- Combine portfolio COUNT + SELECT into one windowed scan.

create or replace function private.suggestion_listing_actor_coverage(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns table (
  has_org_read boolean,
  has_self_read boolean,
  has_org_review boolean,
  has_org_manage boolean,
  readable_unit_ids uuid[],
  reviewable_unit_ids uuid[],
  manageable_unit_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_units uuid[];
begin
  if target_organisation_id is null or target_membership_id is null then
    has_org_read := false;
    has_self_read := false;
    has_org_review := false;
    has_org_manage := false;
    readable_unit_ids := '{}'::uuid[];
    reviewable_unit_ids := '{}'::uuid[];
    manageable_unit_ids := '{}'::uuid[];
    return next;
    return;
  end if;

  has_org_read := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.read',
    null,
    null
  );
  has_self_read := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.read',
    target_membership_id,
    null
  );
  has_org_review := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.review',
    null,
    null
  );
  has_org_manage := private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.manage',
    null,
    null
  );

  if has_org_read and has_org_review and has_org_manage then
    readable_unit_ids := '{}'::uuid[];
    reviewable_unit_ids := '{}'::uuid[];
    manageable_unit_ids := '{}'::uuid[];
    return next;
    return;
  end if;

  select coalesce(array_agg(distinct unit_id), '{}'::uuid[])
  into candidate_units
  from (
    select suggestion_row.origin_unit_id as unit_id
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.origin_unit_id is not null
    union
    select suggestion_row.review_jurisdiction_unit_id
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.review_jurisdiction_unit_id is not null
  ) units;

  if has_org_read then
    readable_unit_ids := '{}'::uuid[];
  else
    select coalesce(array_agg(unit_id), '{}'::uuid[])
    into readable_unit_ids
    from unnest(candidate_units) as unit_id
    where private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'suggestions.read',
      null,
      unit_id
    );
  end if;

  if has_org_review then
    reviewable_unit_ids := '{}'::uuid[];
  else
    select coalesce(array_agg(unit_id), '{}'::uuid[])
    into reviewable_unit_ids
    from unnest(candidate_units) as unit_id
    where private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'suggestions.review',
      null,
      unit_id
    );
  end if;

  if has_org_manage then
    manageable_unit_ids := '{}'::uuid[];
  else
    select coalesce(array_agg(unit_id), '{}'::uuid[])
    into manageable_unit_ids
    from unnest(candidate_units) as unit_id
    where private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'suggestions.manage',
      null,
      unit_id
    );
  end if;

  return next;
end;
$$;

create or replace function private.suggestion_matches_listing_coverage(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_origin_unit_id uuid,
  target_jurisdiction_unit_id uuid,
  target_author_membership_id uuid,
  target_actor_membership_id uuid,
  has_org_read boolean,
  has_self_read boolean,
  has_org_review boolean,
  readable_unit_ids uuid[],
  reviewable_unit_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    has_org_read
    or target_origin_unit_id = any (readable_unit_ids)
    or target_jurisdiction_unit_id = any (readable_unit_ids)
    or (
      has_self_read
      and (
        target_author_membership_id = target_actor_membership_id
        or private.is_active_suggestion_contributor(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or private.is_active_suggestion_reviewer(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
      )
    )
    or (
      private.is_active_suggestion_reviewer(
        target_organisation_id,
        target_suggestion_id,
        target_actor_membership_id
      )
      and (
        has_org_review
        or target_jurisdiction_unit_id = any (reviewable_unit_ids)
      )
    );
$$;

create or replace function public.get_suggestions_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  result jsonb;
begin
  if org_id is null then
    raise exception 'suggestions overview is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  select jsonb_build_object(
    'submitted_this_month', count(*) filter (
      where suggestion_row.submitted_at >= date_trunc('month', statement_timestamp())
    ),
    'awaiting_review', count(*) filter (
      where suggestion_row.status in ('submitted', 'under_review')
    ),
    'accepted', count(*) filter (where suggestion_row.status = 'accepted'),
    'implementing', count(*) filter (where suggestion_row.status = 'implementing'),
    'implemented', count(*) filter (where suggestion_row.status = 'implemented'),
    'pipeline', jsonb_build_object(
      'submitted', count(*) filter (where suggestion_row.status = 'submitted'),
      'under_review', count(*) filter (where suggestion_row.status = 'under_review'),
      'accepted', count(*) filter (where suggestion_row.status = 'accepted'),
      'implementing', count(*) filter (where suggestion_row.status = 'implementing'),
      'implemented', count(*) filter (where suggestion_row.status = 'implemented')
    )
  )
  into result
  from public.improvement_suggestions suggestion_row
  cross join private.suggestion_listing_actor_coverage(
    org_id,
    actor_membership_id
  ) coverage
  where suggestion_row.organisation_id = org_id
    and private.suggestion_matches_listing_coverage(
      org_id,
      suggestion_row.id,
      suggestion_row.origin_unit_id,
      suggestion_row.review_jurisdiction_unit_id,
      suggestion_row.author_membership_id,
      actor_membership_id,
      coverage.has_org_read,
      coverage.has_self_read,
      coverage.has_org_review,
      coverage.readable_unit_ids,
      coverage.reviewable_unit_ids
    );

  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.get_suggestion_portfolio(
  target_q text default null,
  target_status text default null,
  target_programme uuid default null,
  target_category uuid default null,
  target_origin_unit uuid default null,
  target_sort text default 'newest',
  target_page integer default 1,
  target_page_size integer default 25,
  target_reviewer text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  reviewer_filter text;
  normalized_sort text;
  normalized_page_size integer;
  normalized_page integer;
  search_pattern text;
  result jsonb;
begin
  if org_id is null then
    raise exception 'suggestion portfolio is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  reviewer_filter := case lower(btrim(coalesce(target_reviewer, 'all')))
    when 'mine' then 'mine'
    when 'unassigned' then 'unassigned'
    else 'all'
  end;

  normalized_sort := case target_sort
    when 'oldest' then 'oldest'
    when 'updated' then 'updated'
    when 'title_asc' then 'title_asc'
    else 'newest'
  end;

  normalized_page_size := case target_page_size
    when 50 then 50
    when 100 then 100
    else 25
  end;

  normalized_page := greatest(coalesce(target_page, 1), 1);

  if target_q is null or btrim(target_q) = '' then
    search_pattern := null;
  else
    search_pattern := '%' || private.escape_ilike_literal(btrim(target_q)) || '%';
  end if;

  with coverage as (
    select *
    from private.suggestion_listing_actor_coverage(org_id, actor_membership_id)
  ),
  filtered as (
    select
      suggestion_row.id,
      suggestion_row.suggestion_number,
      suggestion_row.title,
      suggestion_row.status,
      suggestion_row.category_name_snapshot,
      suggestion_row.programme_name_snapshot,
      suggestion_row.origin_unit_name_snapshot,
      suggestion_row.submitted_at,
      suggestion_row.created_at,
      suggestion_row.updated_at,
      active_assignment.reviewer_membership_id as active_reviewer_member_id,
      nullif(
        btrim(
          coalesce(reviewer_membership.display_name, reviewer_profile.display_name)
        ),
        ''
      ) as active_reviewer_display_name,
      active_assignment.assignment_kind as active_reviewer_assignment_kind,
      active_assignment.assigned_at as active_reviewer_assigned_at,
      (
        active_assignment.reviewer_membership_id is not null
        and active_assignment.reviewer_membership_id = actor_membership_id
      ) as is_active_reviewer,
      (
        coverage.has_org_review
        or suggestion_row.review_jurisdiction_unit_id = any (coverage.reviewable_unit_ids)
      ) as can_review,
      (
        coverage.has_org_manage
        or suggestion_row.review_jurisdiction_unit_id = any (coverage.manageable_unit_ids)
      ) as can_manage_review,
      count(*) over () as total_count,
      row_number() over (
        order by
          case normalized_sort
            when 'oldest' then suggestion_row.created_at
          end asc nulls last,
          case normalized_sort
            when 'updated' then suggestion_row.updated_at
            when 'newest' then suggestion_row.created_at
          end desc nulls last,
          case normalized_sort
            when 'title_asc' then suggestion_row.title
          end asc nulls last,
          case
            when normalized_sort in ('oldest', 'title_asc') then suggestion_row.id
          end asc nulls last,
          case
            when normalized_sort in ('newest', 'updated') then suggestion_row.id
          end desc nulls last
      ) as rn
    from public.improvement_suggestions suggestion_row
    cross join coverage
    left join lateral (
      select
        assignment_row.reviewer_membership_id,
        assignment_row.assignment_kind,
        assignment_row.assigned_at
      from public.suggestion_review_assignments assignment_row
      where assignment_row.organisation_id = suggestion_row.organisation_id
        and assignment_row.suggestion_id = suggestion_row.id
        and assignment_row.status = 'active'
      limit 1
    ) active_assignment on true
    left join public.organisation_memberships reviewer_membership
      on reviewer_membership.organisation_id = suggestion_row.organisation_id
      and reviewer_membership.id = active_assignment.reviewer_membership_id
    left join public.profiles reviewer_profile
      on reviewer_profile.user_id = reviewer_membership.user_id
    where suggestion_row.organisation_id = org_id
      and private.suggestion_matches_listing_coverage(
        org_id,
        suggestion_row.id,
        suggestion_row.origin_unit_id,
        suggestion_row.review_jurisdiction_unit_id,
        suggestion_row.author_membership_id,
        actor_membership_id,
        coverage.has_org_read,
        coverage.has_self_read,
        coverage.has_org_review,
        coverage.readable_unit_ids,
        coverage.reviewable_unit_ids
      )
      and (target_status is null or suggestion_row.status = target_status)
      and (target_programme is null or suggestion_row.programme_version_id = target_programme)
      and (target_category is null or suggestion_row.category_id = target_category)
      and (target_origin_unit is null or suggestion_row.origin_unit_id = target_origin_unit)
      and (
        search_pattern is null
        or suggestion_row.title ilike search_pattern escape '\'
        or suggestion_row.suggestion_number ilike search_pattern escape '\'
      )
      and (
        reviewer_filter = 'all'
        or (
          reviewer_filter = 'mine'
          and active_assignment.reviewer_membership_id = actor_membership_id
          and (
            coverage.has_org_review
            or suggestion_row.review_jurisdiction_unit_id = any (coverage.reviewable_unit_ids)
            or coverage.has_org_manage
            or suggestion_row.review_jurisdiction_unit_id = any (coverage.manageable_unit_ids)
          )
        )
        or (
          reviewer_filter = 'unassigned'
          and active_assignment.reviewer_membership_id is null
          and (
            coverage.has_org_review
            or suggestion_row.review_jurisdiction_unit_id = any (coverage.reviewable_unit_ids)
            or coverage.has_org_manage
            or suggestion_row.review_jurisdiction_unit_id = any (coverage.manageable_unit_ids)
          )
        )
      )
  ),
  meta as (
    select
      coalesce((select filtered.total_count from filtered limit 1), 0) as total_count
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', portfolio_row.id,
            'suggestion_number', portfolio_row.suggestion_number,
            'title', portfolio_row.title,
            'status', portfolio_row.status,
            'category_name_snapshot', portfolio_row.category_name_snapshot,
            'programme_name_snapshot', portfolio_row.programme_name_snapshot,
            'origin_unit_name_snapshot', portfolio_row.origin_unit_name_snapshot,
            'submitted_at', portfolio_row.submitted_at,
            'created_at', portfolio_row.created_at,
            'updated_at', portfolio_row.updated_at,
            'active_reviewer_member_id', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.active_reviewer_member_id
              else null
            end,
            'active_reviewer_display_name', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.active_reviewer_display_name
              else null
            end,
            'active_reviewer_assignment_kind', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.active_reviewer_assignment_kind
              else null
            end,
            'active_reviewer_assigned_at', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.active_reviewer_assigned_at
              else null
            end,
            'is_active_reviewer', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.is_active_reviewer
              else false
            end,
            'can_review', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.can_review
              else false
            end,
            'can_manage_review', case
              when portfolio_row.can_view_reviewer_metadata
              then portfolio_row.can_manage_review
              else false
            end
          )
          order by portfolio_row.rn
        )
        from (
          select
            filtered.*,
            (
              filtered.is_active_reviewer
              or filtered.can_review
              or filtered.can_manage_review
            ) as can_view_reviewer_metadata
          from filtered
          cross join meta
          where filtered.rn > (
              least(
                normalized_page,
                greatest(
                  1,
                  ceil(meta.total_count::numeric / normalized_page_size::numeric)::integer
                )
              ) - 1
            ) * normalized_page_size
            and filtered.rn <= least(
              normalized_page,
              greatest(
                1,
                ceil(meta.total_count::numeric / normalized_page_size::numeric)::integer
              )
            ) * normalized_page_size
        ) portfolio_row
      ),
      '[]'::jsonb
    ),
    'total_count', meta.total_count,
    'page', least(
      normalized_page,
      greatest(
        1,
        ceil(meta.total_count::numeric / normalized_page_size::numeric)::integer
      )
    ),
    'page_size', normalized_page_size
  )
  into result
  from meta;

  return result;
end;
$$;

grant execute on function public.get_suggestions_overview() to authenticated;
revoke all on function public.get_suggestions_overview() from public, anon;

grant execute on function public.get_suggestion_portfolio(
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  integer,
  integer,
  text
) to authenticated;
revoke all on function public.get_suggestion_portfolio(
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  integer,
  integer,
  text
) from public, anon;

revoke all on function private.suggestion_listing_actor_coverage(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.suggestion_matches_listing_coverage(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  boolean,
  boolean,
  boolean,
  uuid[],
  uuid[]
) from public, anon, authenticated;

alter function private.suggestion_listing_actor_coverage(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.suggestion_matches_listing_coverage(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  boolean,
  boolean,
  boolean,
  uuid[],
  uuid[]
) owner to lean_hub_private_owner;
