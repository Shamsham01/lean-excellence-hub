-- BEN-001: scope project portfolio queries by active site boundary and unit subtree.

drop function if exists public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer
);

create or replace function public.get_ci_projects_portfolio(
  target_search text default null,
  target_status text default null,
  target_unit_id uuid default null,
  target_priority text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_site_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'project portfolio is not authorised'
      using errcode = '42501';
  end if;

  offset_val := greatest((target_page - 1) * target_page_size, 0);

  select count(*)
  into total_count
  from public.ci_projects project_row
  where project_row.organisation_id = org_id
    and private.can_read_ci_project(org_id, project_row.id)
    and (target_status is null or project_row.status = target_status)
    and (
      target_unit_id is null
      or exists (
        select 1
        from public.organisation_unit_closure closure
        where closure.organisation_id = org_id
          and closure.ancestor_unit_id = target_unit_id
          and closure.descendant_unit_id = project_row.unit_id
      )
    )
    and (
      target_site_unit_id is null
      or project_row.site_unit_id = target_site_unit_id
    )
    and (target_priority is null or project_row.priority = target_priority)
    and (
      target_search is null
      or project_row.title ilike '%' || target_search || '%'
      or project_row.project_number ilike '%' || target_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', project_row.id,
        'project_number', project_row.project_number,
        'title', project_row.title,
        'status', project_row.status,
        'priority', project_row.priority,
        'unit_id', project_row.unit_id,
        'site_unit_id', project_row.site_unit_id,
        'methodology_version_id', project_row.methodology_version_id,
        'planned_start_date', project_row.planned_start_date,
        'planned_end_date', project_row.planned_end_date,
        'actual_start_at', project_row.actual_start_at,
        'actual_end_at', project_row.actual_end_at,
        'created_by_membership_id', project_row.created_by_membership_id,
        'created_at', project_row.created_at,
        'updated_at', project_row.updated_at
      )
      order by project_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.ci_projects project_row
  where project_row.organisation_id = org_id
    and private.can_read_ci_project(org_id, project_row.id)
    and (target_status is null or project_row.status = target_status)
    and (
      target_unit_id is null
      or exists (
        select 1
        from public.organisation_unit_closure closure
        where closure.organisation_id = org_id
          and closure.ancestor_unit_id = target_unit_id
          and closure.descendant_unit_id = project_row.unit_id
      )
    )
    and (
      target_site_unit_id is null
      or project_row.site_unit_id = target_site_unit_id
    )
    and (target_priority is null or project_row.priority = target_priority)
    and (
      target_search is null
      or project_row.title ilike '%' || target_search || '%'
      or project_row.project_number ilike '%' || target_search || '%'
    )
  limit target_page_size
  offset offset_val;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;

grant execute on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid
) to authenticated;

revoke all on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid
) from public, anon;
