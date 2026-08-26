-- Milestone 8: extend ci_projects with charter fields, methodology link, dates, priority, and status model.

alter table public.ci_projects
  add column scope_in text,
  add column scope_out text,
  add column baseline_summary text,
  add column target_summary text,
  add column constraints_risks text,
  add column sustainment_expectation text,
  add column methodology_version_id uuid,
  add column planned_start_date date,
  add column planned_end_date date,
  add column priority text not null default 'normal',
  add column actual_start_at timestamptz,
  add column actual_end_at timestamptz;

alter table public.ci_projects
  add constraint ci_projects_methodology_version_fkey
    foreign key (organisation_id, methodology_version_id)
    references public.ci_project_methodology_versions(organisation_id, id)
    on delete restrict;

alter table public.ci_projects
  add constraint ci_projects_priority_check
    check (priority in ('low', 'normal', 'high', 'critical'));

alter table public.ci_projects
  add constraint ci_projects_planned_dates_check
    check (
      planned_start_date is null
      or planned_end_date is null
      or planned_end_date >= planned_start_date
    );

update public.ci_projects
set status = 'submitted'
where status = 'charter_submitted';

alter table public.ci_projects
  drop constraint ci_projects_status_check;

alter table public.ci_projects
  add constraint ci_projects_status_check
    check (
      status in (
        'draft',
        'submitted',
        'approved',
        'active',
        'on_hold',
        'completed',
        'cancelled'
      )
    );

create index ci_projects_org_methodology_idx
  on public.ci_projects (organisation_id, methodology_version_id);
create index ci_projects_org_priority_idx
  on public.ci_projects (organisation_id, priority);
