-- Preserve direct manager edits of ordinary project fields under existing RLS.
-- Methodology version selection stays in the draft RPC, which validates publication.
revoke update on public.ci_projects from authenticated;
grant update (
  title,
  problem_statement,
  objective,
  expected_impact_summary,
  scope_in,
  scope_out,
  baseline_summary,
  target_summary,
  constraints_risks,
  sustainment_expectation,
  planned_start_date,
  planned_end_date,
  priority
) on public.ci_projects to authenticated;

create function private.guard_ci_project_lifecycle_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The existing mutation RPCs run as this dedicated role.
  if current_user <> 'lean_hub_private_owner'
    and row(
      new.status,
      new.actual_start_at,
      new.actual_end_at,
      new.charter_submitted_at,
      new.charter_submitted_by_membership_id,
      new.methodology_version_id,
      new.id,
      new.organisation_id,
      new.unit_id,
      new.site_unit_id,
      new.project_number,
      new.created_by_membership_id,
      new.created_at,
      new.updated_at
    ) is distinct from row(
      old.status,
      old.actual_start_at,
      old.actual_end_at,
      old.charter_submitted_at,
      old.charter_submitted_by_membership_id,
      old.methodology_version_id,
      old.id,
      old.organisation_id,
      old.unit_id,
      old.site_unit_id,
      old.project_number,
      old.created_by_membership_id,
      old.created_at,
      old.updated_at
    ) then
    raise exception 'protected CI project columns must be changed through project operations'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

alter function private.guard_ci_project_lifecycle_columns() owner to lean_hub_private_owner;
revoke execute on function private.guard_ci_project_lifecycle_columns()
  from public, anon, authenticated, service_role;

-- The guard runs before ci_projects_touch_updated_at in trigger name order.
create trigger ci_projects_guard_lifecycle_columns
before update on public.ci_projects
for each row execute function private.guard_ci_project_lifecycle_columns();

alter function private.guard_action_project_link_status() owner to lean_hub_private_owner;
