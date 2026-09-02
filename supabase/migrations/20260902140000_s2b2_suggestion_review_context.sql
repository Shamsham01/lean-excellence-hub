-- S2b2: assignment-aware suggestion review workspace context.

create or replace function public.get_suggestion_review_context(
  target_suggestion_id uuid
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
  suggestion_row public.improvement_suggestions%rowtype;
  can_view_metadata boolean;
  has_active_reviewer boolean;
  active_reviewer_member_id uuid;
  active_reviewer_display_name text;
  active_reviewer_assignment_kind text;
  active_reviewer_assigned_at timestamptz;
  eligible_reviewers jsonb;
begin
  if org_id is null then
    raise exception 'review context is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  can_view_metadata := private.can_view_suggestion_reviewer_metadata(
    org_id,
    suggestion_row.id,
    suggestion_row.review_jurisdiction_unit_id,
    actor_membership_id
  );

  has_active_reviewer := private.suggestion_has_active_reviewer(org_id, suggestion_row.id);

  if can_view_metadata then
    select
      assignment_row.reviewer_membership_id,
      nullif(
        btrim(
          coalesce(reviewer_membership.display_name, reviewer_profile.display_name)
        ),
        ''
      ),
      assignment_row.assignment_kind,
      assignment_row.assigned_at
    into
      active_reviewer_member_id,
      active_reviewer_display_name,
      active_reviewer_assignment_kind,
      active_reviewer_assigned_at
    from public.suggestion_review_assignments assignment_row
    left join public.organisation_memberships reviewer_membership
      on reviewer_membership.organisation_id = assignment_row.organisation_id
      and reviewer_membership.id = assignment_row.reviewer_membership_id
    left join public.profiles reviewer_profile
      on reviewer_profile.user_id = reviewer_membership.user_id
    where assignment_row.organisation_id = org_id
      and assignment_row.suggestion_id = suggestion_row.id
      and assignment_row.status = 'active'
    limit 1;
  end if;

  if private.can_assign_suggestion_reviewer(
    org_id,
    suggestion_row.review_jurisdiction_unit_id
  )
  and suggestion_row.status in ('submitted', 'under_review', 'parked') then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', eligible_row.member_id,
          'display_name', eligible_row.display_name
        )
        order by eligible_row.display_name nulls last, eligible_row.member_id
      ),
      '[]'::jsonb
    )
    into eligible_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(
          btrim(
            coalesce(membership_row.display_name, profile_row.display_name)
          ),
          ''
        ) as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row
        on profile_row.user_id = membership_row.user_id
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and private.membership_can_review_suggestion_jurisdiction(
          org_id,
          membership_row.id,
          suggestion_row.review_jurisdiction_unit_id
        )
    ) eligible_row;
  else
    eligible_reviewers := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'suggestion', jsonb_build_object(
      'id', suggestion_row.id,
      'suggestion_number', suggestion_row.suggestion_number,
      'title', suggestion_row.title,
      'status', suggestion_row.status,
      'problem_or_opportunity', suggestion_row.problem_or_opportunity,
      'proposed_idea', suggestion_row.proposed_idea,
      'category_name', suggestion_row.category_name_snapshot,
      'programme_name', suggestion_row.programme_name_snapshot,
      'origin_unit_name', suggestion_row.origin_unit_name_snapshot,
      'submitted_at', suggestion_row.submitted_at,
      'created_at', suggestion_row.created_at,
      'updated_at', suggestion_row.updated_at,
      'parked_at', suggestion_row.parked_at,
      'parked_rationale', suggestion_row.parked_rationale
    ),
    'reviewer', case
      when can_view_metadata and active_reviewer_member_id is not null then
        jsonb_build_object(
          'member_id', active_reviewer_member_id,
          'display_name', active_reviewer_display_name,
          'assignment_kind', active_reviewer_assignment_kind,
          'assigned_at', active_reviewer_assigned_at
        )
      else null
    end,
    'permissions', jsonb_build_object(
      'is_active_reviewer', private.is_active_suggestion_reviewer(
        org_id,
        suggestion_row.id,
        actor_membership_id
      ),
      'can_claim',
        suggestion_row.status = 'submitted'
        and not has_active_reviewer
        and private.can_claim_suggestion_for_review(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_assign',
        suggestion_row.status in ('submitted', 'under_review', 'parked')
        and private.can_assign_suggestion_reviewer(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_begin_review',
        suggestion_row.status in ('submitted', 'parked')
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        ),
      'can_record_review',
        suggestion_row.status = 'under_review'
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        )
    ),
    'eligible_reviewers', eligible_reviewers
  );
end;
$$;

grant execute on function public.get_suggestion_review_context(uuid) to authenticated;

revoke all on function public.get_suggestion_review_context(uuid) from public, anon;
