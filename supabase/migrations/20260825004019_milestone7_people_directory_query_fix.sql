-- Fix get_people_directory: ORDER BY/LIMIT must wrap jsonb_agg in a subquery.

create or replace function public.get_people_directory(
  target_search text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_value integer;
begin
  if org_id is null
    or not private.can_read_people_directory(org_id) then
    raise exception 'people directory is not authorised'
      using errcode = '42501';
  end if;

  offset_value := greatest(target_page - 1, 0) * target_page_size;

  return jsonb_build_object(
    'people',
      coalesce(
        (
          select jsonb_agg(directory_row.row_data)
          from (
            select jsonb_build_object(
              'membership_id', membership_row.id,
              'display_name',
                coalesce(membership_row.display_name, profile_row.display_name),
              'job_title', membership_row.job_title,
              'job_function_name', assignment_row.job_function_name_snapshot,
              'job_function_code', assignment_row.job_function_code_snapshot
            ) as row_data
            from public.organisation_memberships membership_row
            left join public.profiles profile_row
              on profile_row.user_id = membership_row.user_id
            left join public.membership_job_function_assignments assignment_row
              on assignment_row.organisation_id = org_id
             and assignment_row.membership_id = membership_row.id
             and assignment_row.is_primary = true
             and assignment_row.valid_from <= statement_timestamp()
             and (
               assignment_row.valid_to is null
               or assignment_row.valid_to > statement_timestamp()
             )
            where membership_row.organisation_id = org_id
              and membership_row.status = 'active'
              and private.can_read_membership_capability_profile(
                org_id,
                membership_row.id
              )
              and (
                target_search is null
                or coalesce(membership_row.display_name, profile_row.display_name, '')
                  ilike '%' || btrim(target_search) || '%'
              )
            order by coalesce(membership_row.display_name, profile_row.display_name)
            limit target_page_size offset offset_value
          ) directory_row
        ),
        '[]'::jsonb
      ),
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;
