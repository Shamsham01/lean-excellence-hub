-- Allow method stage reads when the member can read an active case on that method version
-- (catalog-only RLS left the guided stage rail empty for case viewers).

create policy problem_solving_method_stages_select_via_readable_case
on public.problem_solving_method_stages for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = problem_solving_method_stages.organisation_id
      and case_row.method_version_id = problem_solving_method_stages.method_version_id
      and private.can_read_problem_solving_case(case_row.organisation_id, case_row.id)
  )
);
