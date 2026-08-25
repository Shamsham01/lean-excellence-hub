-- Capability profile header for scoped readers who cannot SELECT memberships directly.

create or replace function public.get_membership_capability_profile_header(
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
  if org_id is null
    or not private.can_read_membership_capability_profile(org_id, target_membership_id) then
    raise exception 'membership capability profile header is not authorised'
      using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'membership_id', membership_row.id,
      'display_name',
        coalesce(membership_row.display_name, profile_row.display_name),
      'job_title', membership_row.job_title,
      'job_function_name', assignment_row.job_function_name_snapshot,
      'organisational_unit_id', assignment_row.organisational_unit_id
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
      and membership_row.id = target_membership_id
      and membership_row.status = 'active'
  );
end;
$$;

grant execute on function public.get_membership_capability_profile_header(uuid)
  to authenticated;
revoke all on function public.get_membership_capability_profile_header(uuid)
  from public, anon;
