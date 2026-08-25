-- People directory and capability dashboard queries.

create or replace function public.get_membership_skills_profile(
  target_membership_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    raise exception 'membership skills profile is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(org_id, 'people.capability.read', target_membership_id, null)
    and not private.has_scoped_permission(org_id, 'people.capability.read', null, null)
    and not private.can_read_skills_catalog(org_id) then
    raise exception 'membership skills profile is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'gaps',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'skill_id', skill_row.id,
              'skill_name', skill_row.name,
              'gap', private.derive_skill_gap(target_membership_id, skill_row.id)
            )
          )
          from public.skills skill_row
          where skill_row.organisation_id = org_id
            and skill_row.status = 'active'
        ),
        '[]'::jsonb
      ),
    'assessments',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'assessment_id', assessment_row.id,
              'skill_id', assessment_row.skill_id,
              'assertion_type', assessment_row.assertion_type,
              'is_authoritative', assessment_row.is_authoritative,
              'proficiency_level_id', assessment_row.proficiency_level_id,
              'proficiency_scale_version_id', assessment_row.proficiency_scale_version_id,
              'assessed_at', assessment_row.assessed_at,
              'assessment_method', assessment_row.assessment_method,
              'valid_until', assessment_row.valid_until
            )
            order by assessment_row.assessed_at desc
          )
          from public.membership_skill_assessments assessment_row
          where assessment_row.organisation_id = org_id
            and assessment_row.membership_id = target_membership_id
        ),
        '[]'::jsonb
      )
  );
end;
$$;

create or replace function public.get_capability_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  training_summary jsonb;
  skill_meeting integer := 0;
  skill_total integer := 0;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'people.capability.read', null, null) then
    raise exception 'capability dashboard is not authorised'
      using errcode = '42501';
  end if;

  training_summary := public.get_training_compliance_summary(null);

  select
    count(*) filter (
      where gap_obj ->> 'status' = 'meets_requirement'
    )::integer,
    count(*)::integer
  into skill_meeting, skill_total
  from public.organisation_memberships membership_row
  cross join public.skills skill_row
  left join lateral private.derive_skill_gap(membership_row.id, skill_row.id) gap_obj on true
  where membership_row.organisation_id = org_id
    and membership_row.status = 'active'
    and skill_row.organisation_id = org_id
    and skill_row.status = 'active'
    and gap_obj ->> 'status' in (
      'meets_requirement',
      'below_requirement',
      'above_requirement',
      'not_assessed'
    );

  return jsonb_build_object(
    'training_compliance_percent', training_summary -> 'compliance_percent',
    'outstanding_required_training', training_summary -> 'outstanding_required',
    'expiring_training_30_days', training_summary -> 'expiring_in_30_days',
    'skill_coverage_percent',
      case
        when skill_total = 0 then null
        else round((skill_meeting::numeric / skill_total::numeric) * 100, 1)
      end
  );
end;
$$;

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
    or not private.has_scoped_permission(org_id, 'people.capability.read', null, null) then
    raise exception 'people directory is not authorised'
      using errcode = '42501';
  end if;

  offset_value := greatest(target_page - 1, 0) * target_page_size;

  return jsonb_build_object(
    'people',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', membership_row.id,
              'display_name', coalesce(membership_row.display_name, profile_row.display_name),
              'job_title', membership_row.job_title,
              'job_function_name', assignment_row.job_function_name_snapshot,
              'job_function_code', assignment_row.job_function_code_snapshot
            )
          )
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
            and (
              target_search is null
              or coalesce(membership_row.display_name, profile_row.display_name, '')
                ilike '%' || btrim(target_search) || '%'
            )
          order by coalesce(membership_row.display_name, profile_row.display_name)
          limit target_page_size offset offset_value
        ),
        '[]'::jsonb
      ),
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;

grant execute on function public.get_membership_skills_profile(uuid) to authenticated;
grant execute on function public.get_capability_dashboard() to authenticated;
grant execute on function public.get_people_directory(text, integer, integer) to authenticated;

revoke all on function public.get_membership_skills_profile(uuid) from public, anon;
revoke all on function public.get_capability_dashboard() from public, anon;
revoke all on function public.get_people_directory(text, integer, integer) from public, anon;
