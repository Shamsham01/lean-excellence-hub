-- MAT0: template_answers had RLS enabled with GRANT SELECT but no SELECT policy,
-- so authenticated reads returned zero rows after upsert_template_answer saved data.

create policy template_answers_select
on public.template_answers for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_submission(organisation_id, submission_id)
);
