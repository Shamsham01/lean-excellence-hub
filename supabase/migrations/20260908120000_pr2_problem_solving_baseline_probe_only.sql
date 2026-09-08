-- PR2 stabilisation: problem_solving.view baseline is navigation/probe only.
-- Record-level case read requires grants, ownership, or participation.
-- Aligns with suggestions.read and RBAC2 foundation design intent.

update private.baseline_participation_permissions
set include_in_scoped_permission = false
where permission_key = 'problem_solving.view'
  and include_in_scoped_permission = true;
