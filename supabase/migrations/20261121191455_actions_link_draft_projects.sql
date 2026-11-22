-- Enforce the action-specific project statuses for both create_project_action
-- and link_action_to_ci_project. Their existing permission checks run first.
create function private.guard_action_project_link_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_status text;
begin
  if tg_op = 'UPDATE' and new.project_id = old.project_id then
    return new;
  end if;

  select project_row.status
    into project_status
    from public.ci_projects project_row
    where project_row.organisation_id = new.organisation_id
      and project_row.id = new.project_id
    for share;

  if not found then
    raise exception 'project link is not authorised' using errcode = '42501';
  end if;

  if project_status in ('completed', 'cancelled') then
    raise exception 'This project is completed or cancelled and cannot accept new links.'
      using errcode = '55000';
  end if;

  if project_status not in ('draft', 'submitted', 'approved', 'active', 'on_hold') then
    raise exception 'Only open projects can accept action links.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_action_project_link_status()
  from public, anon, authenticated, service_role;

create trigger ci_project_action_context_guard_link_status
before insert or update of project_id on public.ci_project_action_context
for each row execute function private.guard_action_project_link_status();
