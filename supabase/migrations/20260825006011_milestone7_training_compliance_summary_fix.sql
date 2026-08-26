-- Fix ambiguous curriculum_version_id in get_training_compliance_summary (db:lint).

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
  resolved_curriculum_version_id uuid;
  total_required integer := 0;
  satisfied integer := 0;
  expiring_count integer := 0;
begin
  if org_id is null
    or not private.can_read_training_catalog(org_id) then
    raise exception 'training compliance summary is not authorised'
      using errcode = '42501';
  end if;

  resolved_curriculum_version_id :=
    private.get_published_training_curriculum_version_id(org_id);

  if resolved_curriculum_version_id is null then
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
     and requirement_row.curriculum_version_id = resolved_curriculum_version_id
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
