-- Self-scoped assessors need to read organisational units when starting self assessments
-- even if they lack hierarchy.read on each unit subtree.

drop policy if exists units_select_scoped on public.organisation_units;
create policy units_select_scoped
on public.organisation_units
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and (
    private.has_scoped_permission(
      organisation_id,
      'hierarchy.read',
      null,
      id
    )
    or private.has_scoped_permission(
      organisation_id,
      'maturity.assess.self',
      private.current_membership_id(organisation_id),
      null
    )
  )
);
