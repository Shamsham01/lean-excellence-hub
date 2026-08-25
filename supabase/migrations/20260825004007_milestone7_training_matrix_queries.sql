-- Training matrix and compliance query RPCs.

create or replace function private.get_published_training_curriculum_version_id(
  target_organisation_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select version_row.id
  from public.training_curriculum_versions version_row
  join public.training_curricula curriculum_row
    on curriculum_row.organisation_id = version_row.organisation_id
   and curriculum_row.id = version_row.curriculum_id
  where version_row.organisation_id = target_organisation_id
    and version_row.status = 'published'
    and curriculum_row.status = 'active'
  order by version_row.published_at desc nulls last
  limit 1
$$;

create or replace function public.get_training_compliance_summary(
  target_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  curriculum_version_id uuid;
  total_required integer := 0;
  satisfied integer := 0;
  expiring_count integer := 0;
begin
  if org_id is null
    or not private.can_read_training_catalog(org_id) then
    raise exception 'training compliance summary is not authorised'
      using errcode = '42501';
  end if;

  curriculum_version_id := private.get_published_training_curriculum_version_id(org_id);

  if curriculum_version_id is null then
    return jsonb_build_object(
      'compliance_percent', null,
      'outstanding_required', 0,
      'expiring_in_30_days', 0
    );
  end if;

  with active_memberships as (
    select membership_row.id as membership_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.status = 'active'
  ),
  applicable_requirements as (
    select
      membership_row.membership_id,
      requirement_row.id as requirement_id,
      requirement_row.course_id,
      requirement_row.mandatory
    from active_memberships membership_row
    join public.training_requirements requirement_row
      on requirement_row.organisation_id = org_id
     and requirement_row.curriculum_version_id = curriculum_version_id
     and requirement_row.mandatory = true
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_row.membership_id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    where requirement_row.applies_to_all_members
      or (
        requirement_row.job_function_id is not null
        and assignment_row.job_function_id = requirement_row.job_function_id
      )
  ),
  requirement_status as (
    select
      applicable_row.membership_id,
      applicable_row.requirement_id,
      private.membership_has_valid_training_completion(
        org_id,
        applicable_row.membership_id,
        applicable_row.course_id
      ) as is_satisfied,
      exists (
        select 1
        from public.training_completions completion_row
        where completion_row.organisation_id = org_id
          and completion_row.membership_id = applicable_row.membership_id
          and completion_row.course_id = applicable_row.course_id
          and completion_row.status = 'completed'
          and completion_row.expires_at is not null
          and completion_row.expires_at > statement_timestamp()
          and completion_row.expires_at <= statement_timestamp() + interval '30 days'
      ) as is_expiring
    from applicable_requirements applicable_row
  )
  select
    count(*)::integer,
    count(*) filter (where is_satisfied)::integer,
    count(*) filter (where is_expiring)::integer
  into total_required, satisfied, expiring_count
  from requirement_status;

  return jsonb_build_object(
    'compliance_percent',
      case
        when total_required = 0 then null
        else round((satisfied::numeric / total_required::numeric) * 100, 1)
      end,
    'outstanding_required', total_required - satisfied,
    'expiring_in_30_days', expiring_count
  );
end;
$$;

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
  curriculum_version_id uuid;
begin
  if org_id is null then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(org_id, 'people.capability.read', target_membership_id, null)
    and not private.has_scoped_permission(org_id, 'people.capability.read', null, null)
    and not private.can_read_training_catalog(org_id) then
    raise exception 'membership training profile is not authorised'
      using errcode = '42501';
  end if;

  curriculum_version_id := private.get_published_training_curriculum_version_id(org_id);

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
            and requirement_row.curriculum_version_id = curriculum_version_id
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

grant execute on function public.get_training_compliance_summary(uuid) to authenticated;
grant execute on function public.get_membership_training_profile(uuid) to authenticated;

revoke all on function public.get_training_compliance_summary(uuid) from public, anon;
revoke all on function public.get_membership_training_profile(uuid) from public, anon;

alter function private.get_published_training_curriculum_version_id(uuid) owner to lean_hub_private_owner;
