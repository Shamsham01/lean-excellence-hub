-- S2b1: reviewer-aware canonical suggestions portfolio query foundation.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.escape_ilike_literal(target_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(
    replace(
      replace(coalesce(target_value, ''), E'\\', E'\\\\'),
      '%',
      E'\\%'
    ),
    '_',
    E'\\_'
  );
$$;

create or replace function private.can_view_suggestion_reviewer_metadata(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_jurisdiction_unit_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_suggestion_reviewer(
    target_organisation_id,
    target_suggestion_id,
    target_actor_membership_id
  )
  or private.can_review_suggestion(
    target_organisation_id,
    target_jurisdiction_unit_id
  )
  or private.can_assign_suggestion_reviewer(
    target_organisation_id,
    target_jurisdiction_unit_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Canonical portfolio RPC
-- ---------------------------------------------------------------------------

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
  total_count integer;
  total_pages integer;
  effective_page integer;
  offset_val integer;
  search_pattern text;
  items jsonb;
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

  select count(*)
  into total_count
  from public.improvement_suggestions suggestion_row
  left join lateral (
    select assignment_row.reviewer_membership_id
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = suggestion_row.organisation_id
      and assignment_row.suggestion_id = suggestion_row.id
      and assignment_row.status = 'active'
    limit 1
  ) active_assignment on true
  where suggestion_row.organisation_id = org_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
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
          private.can_review_suggestion(org_id, suggestion_row.review_jurisdiction_unit_id)
          or private.can_assign_suggestion_reviewer(
            org_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
      )
      or (
        reviewer_filter = 'unassigned'
        and active_assignment.reviewer_membership_id is null
        and private.can_claim_suggestion_for_review(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        )
      )
    );

  total_pages := greatest(1, ceil(total_count::numeric / normalized_page_size::numeric)::integer);
  effective_page := least(normalized_page, total_pages);
  offset_val := (effective_page - 1) * normalized_page_size;

  select coalesce(
    jsonb_agg(
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
      order by
        case normalized_sort
          when 'oldest' then portfolio_row.created_at
        end asc nulls last,
        case normalized_sort
          when 'updated' then portfolio_row.updated_at
          when 'newest' then portfolio_row.created_at
        end desc nulls last,
        case normalized_sort
          when 'title_asc' then portfolio_row.title
        end asc nulls last,
        portfolio_row.id asc
    ),
    '[]'::jsonb
  )
  into items
  from (
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
      private.can_review_suggestion(
        org_id,
        suggestion_row.review_jurisdiction_unit_id
      ) as can_review,
      private.can_assign_suggestion_reviewer(
        org_id,
        suggestion_row.review_jurisdiction_unit_id
      ) as can_manage_review,
      private.can_view_suggestion_reviewer_metadata(
        org_id,
        suggestion_row.id,
        suggestion_row.review_jurisdiction_unit_id,
        actor_membership_id
      ) as can_view_reviewer_metadata
    from public.improvement_suggestions suggestion_row
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
      and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
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
            private.can_review_suggestion(org_id, suggestion_row.review_jurisdiction_unit_id)
            or private.can_assign_suggestion_reviewer(
              org_id,
              suggestion_row.review_jurisdiction_unit_id
            )
          )
        )
        or (
          reviewer_filter = 'unassigned'
          and active_assignment.reviewer_membership_id is null
          and private.can_claim_suggestion_for_review(
            org_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
      )
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
      suggestion_row.id asc
    limit normalized_page_size
    offset offset_val
  ) portfolio_row;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', effective_page,
    'page_size', normalized_page_size
  );
end;
$$;

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

alter function private.escape_ilike_literal(text) owner to lean_hub_private_owner;
alter function private.can_view_suggestion_reviewer_metadata(uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
