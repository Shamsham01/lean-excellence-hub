-- Fix ambiguous curriculum_version_id reference in training profile RPC.

create or replace function public.get_membership_training_profile(
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
  published_curriculum_version_id uuid;
begin
  if org_id is null then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  published_curriculum_version_id :=
    private.get_published_training_curriculum_version_id(org_id);

  return jsonb_build_object(
    'requirements',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'requirement_id', requirement_row.id,
              'course_id', requirement_row.course_id,
              'course_name', course_row.name,
              'mandatory', requirement_row.mandatory,
              'is_satisfied',
                private.membership_has_valid_training_completion(
                  org_id,
                  target_membership_id,
                  requirement_row.course_id
                )
            )
          )
          from public.training_requirements requirement_row
          join public.training_courses course_row
            on course_row.organisation_id = requirement_row.organisation_id
           and course_row.id = requirement_row.course_id
          left join public.membership_job_function_assignments assignment_row
            on assignment_row.organisation_id = org_id
           and assignment_row.membership_id = target_membership_id
           and assignment_row.is_primary = true
           and assignment_row.valid_from <= statement_timestamp()
           and (
             assignment_row.valid_to is null
             or assignment_row.valid_to > statement_timestamp()
           )
          where requirement_row.organisation_id = org_id
            and requirement_row.curriculum_version_id =
              published_curriculum_version_id
            and (
              requirement_row.applies_to_all_members
              or (
                requirement_row.job_function_id is not null
                and assignment_row.job_function_id = requirement_row.job_function_id
              )
            )
        ),
        '[]'::jsonb
      ),
    'completions',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'completion_id', completion_row.id,
              'course_id', completion_row.course_id,
              'course_version_id', completion_row.course_version_id,
              'completed_at', completion_row.completed_at,
              'status', completion_row.status,
              'validity_state',
                private.derive_training_completion_validity_state(
                  completion_row.status,
                  completion_row.expires_at
                ),
              'expires_at', completion_row.expires_at
            )
            order by completion_row.completed_at desc
          )
          from public.training_completions completion_row
          where completion_row.organisation_id = org_id
            and completion_row.membership_id = target_membership_id
        ),
        '[]'::jsonb
      )
  );
end;
$$;
