# ADR-0015: Assigned workforce action completion

## Status

Proposed — deferred from M1 Team Member experience closure.

## Context

Team Members currently receive `actions.read` only. They do not receive
`actions.update`, `actions.assign`, or `actions.complete`.

The Actions page therefore renders read-only lists for Team Members. However,
product expectation is that ordinary employees should eventually be able to
update or complete actions explicitly assigned to themselves without gaining
authority to mutate every action visible within their unit subtree.

## Decision (deferred)

Do **not** implement a broader self-assignment completion model in M1 closure.

A future change should introduce an explicit, least-privilege primitive such as
"complete assigned action when `assignee_membership_id = current_membership`"
rather than granting subtree-wide `actions.update` or `actions.complete`.

## Consequences

- Team Member Actions UI remains read-only until a dedicated authorization path
  exists and is covered by RLS/RPC tests.
- Any future implementation must preserve scope isolation and must not weaken
  existing action administration boundaries.
