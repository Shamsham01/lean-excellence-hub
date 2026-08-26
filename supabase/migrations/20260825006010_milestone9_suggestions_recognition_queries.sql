-- Milestone 9: suggestions and recognition query layer.

create or replace function public.get_suggestions_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  result jsonb;
begin
  if org_id is null or not private.has_scoped_permission(org_id, 'suggestions.read', null, null)
    and not private.has_scoped_permission(org_id, 'suggestions.review', null, null) then
    raise exception 'suggestions overview is not authorised' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'submitted_this_month', count(*) filter (where suggestion_row.submitted_at >= date_trunc('month', statement_timestamp())),
    'awaiting_review', count(*) filter (where suggestion_row.status in ('submitted', 'under_review')),
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
  ) into result
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id);
  return coalesce(result, '{}'::jsonb);
end; $$;

create or replace function public.get_suggestions_list(
  target_search text default null,
  target_status text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  offset_val := greatest((target_page - 1) * target_page_size, 0);
  select count(*) into total_count
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
    and (target_status is null or suggestion_row.status = target_status)
    and (target_search is null or suggestion_row.title ilike '%' || target_search || '%'
      or suggestion_row.suggestion_number ilike '%' || target_search || '%');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'status', suggestion_row.status,
    'category_name', suggestion_row.category_name_snapshot,
    'programme_name', suggestion_row.programme_name_snapshot,
    'submitted_at', suggestion_row.submitted_at,
    'author_membership_id', suggestion_row.author_membership_id
  ) order by suggestion_row.created_at desc), '[]'::jsonb) into items
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
    and (target_status is null or suggestion_row.status = target_status)
    and (target_search is null or suggestion_row.title ilike '%' || target_search || '%'
      or suggestion_row.suggestion_number ilike '%' || target_search || '%')
  limit target_page_size offset offset_val;
  return jsonb_build_object('items', items, 'total_count', total_count, 'page', target_page, 'page_size', target_page_size);
end; $$;

create or replace function public.get_suggestion_detail(target_suggestion_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  suggestion_row public.improvement_suggestions%rowtype;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion detail is not authorised' using errcode = '42501';
  end if;
  select suggestion_table.* into suggestion_row from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;
  return jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'problem_or_opportunity', suggestion_row.problem_or_opportunity,
    'proposed_idea', suggestion_row.proposed_idea,
    'expected_benefit_summary', suggestion_row.expected_benefit_summary,
    'status', suggestion_row.status,
    'programme_name_snapshot', suggestion_row.programme_name_snapshot,
    'category_name_snapshot', suggestion_row.category_name_snapshot,
    'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
    'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
    'author_membership_id', suggestion_row.author_membership_id,
    'submitted_at', suggestion_row.submitted_at,
    'implementation_summary', suggestion_row.implementation_summary,
    'implementation_outcome', suggestion_row.implementation_outcome,
    'implemented_at', suggestion_row.implemented_at
  );
end; $$;

create or replace function public.get_suggestion_review_queue()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'status', suggestion_row.status,
    'submitted_at', suggestion_row.submitted_at,
    'category_name', suggestion_row.category_name_snapshot,
    'origin_unit_name', suggestion_row.origin_unit_name_snapshot
  ) order by suggestion_row.submitted_at nulls last), '[]'::jsonb) into items
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and suggestion_row.status in ('submitted', 'under_review')
    and private.can_review_suggestion(org_id, suggestion_row.review_jurisdiction_unit_id)
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id);
  return jsonb_build_object('items', items);
end; $$;

create or replace function public.get_membership_improvement_contribution(target_membership_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  authored_count integer;
  implemented_count integer;
  recognition_count integer;
begin
  select count(*) into authored_count
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and suggestion_row.author_membership_id = target_membership_id
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id);
  select count(*) into implemented_count
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = org_id
    and suggestion_row.status = 'implemented'
    and private.can_read_improvement_suggestion(org_id, suggestion_row.id)
    and exists (
      select 1 from public.suggestion_contributor_assignments assignment_row
      where assignment_row.organisation_id = org_id
        and assignment_row.suggestion_id = suggestion_row.id
        and assignment_row.membership_id = target_membership_id
        and assignment_row.contribution_role = 'implementer'
    );
  select count(*) into recognition_count
  from public.recognition_recipients recipient_row
  join public.recognition_awards award_row
    on award_row.organisation_id = recipient_row.organisation_id
    and award_row.id = recipient_row.recognition_award_id
  where recipient_row.organisation_id = org_id
    and recipient_row.membership_id = target_membership_id
    and private.can_read_recognition_award(org_id, award_row.id);
  return jsonb_build_object(
    'suggestions_authored', authored_count,
    'suggestions_implemented_involvement', implemented_count,
    'recognition_received', recognition_count
  );
end; $$;

create or replace function public.get_recognition_feed(
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
begin
  offset_val := greatest((target_page - 1) * target_page_size, 0);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', award_row.id,
    'title', award_row.title,
    'message', award_row.message,
    'recognition_type_name', award_row.recognition_type_name_snapshot,
    'awarded_at', award_row.awarded_at,
    'visibility', award_row.visibility,
    'source_resource_id', case when private.can_access_resource(org_id, award_row.source_resource_id)
      then award_row.source_resource_id else null end
  ) order by award_row.awarded_at desc), '[]'::jsonb) into items
  from public.recognition_awards award_row
  where award_row.organisation_id = org_id
    and private.can_read_recognition_award(org_id, award_row.id)
  limit target_page_size offset offset_val;
  return jsonb_build_object('items', items, 'page', target_page);
end; $$;

create or replace function public.get_membership_recognition(target_membership_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', award_row.id,
    'title', award_row.title,
    'message', award_row.message,
    'recognition_type_name', award_row.recognition_type_name_snapshot,
    'awarded_at', award_row.awarded_at
  ) order by award_row.awarded_at desc), '[]'::jsonb) into items
  from public.recognition_awards award_row
  join public.recognition_recipients recipient_row
    on recipient_row.organisation_id = award_row.organisation_id
    and recipient_row.recognition_award_id = award_row.id
  where award_row.organisation_id = org_id
    and recipient_row.membership_id = target_membership_id
    and private.can_read_recognition_award(org_id, award_row.id);
  return jsonb_build_object('items', items);
end; $$;

grant execute on function public.get_suggestions_overview() to authenticated;
grant execute on function public.get_suggestions_list(text, text, integer, integer) to authenticated;
grant execute on function public.get_suggestion_detail(uuid) to authenticated;
grant execute on function public.get_suggestion_review_queue() to authenticated;
grant execute on function public.get_membership_improvement_contribution(uuid) to authenticated;
grant execute on function public.get_recognition_feed(integer, integer) to authenticated;
grant execute on function public.get_membership_recognition(uuid) to authenticated;
