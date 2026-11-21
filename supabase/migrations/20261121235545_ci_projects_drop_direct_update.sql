revoke update on public.ci_projects from authenticated;
drop policy if exists ci_projects_update_manage on public.ci_projects;
