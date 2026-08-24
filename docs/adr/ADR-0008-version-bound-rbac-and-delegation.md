# ADR-0008: Version-bound RBAC and delegation

## Status

Accepted for Milestone 3 implementation. This ADR supplements
[ADR-0002](ADR-0002-multi-tenant-membership-and-rls.md).

## Context

Stable role identity is useful for administration, but binding grants or
invitations to a mutable role would allow later permission edits to expand
authority silently. An administrator who can assign a role also must not be
able to delegate permissions or scope they do not currently hold.

## Decision

Separate stable organisation-owned roles from immutable role versions.
Published role versions and their permission relationships cannot change in
place; edits create a successor version. Access grants and invitation offers
bind an exact published role version and exact `self`, `unit_subtree`, or
`organisation` scope.

Role publication, grant issue, role-version migration, and invitation issue or
acceptance require an explicit administration permission plus containment. The
actor may delegate only permissions they currently possess and only at an equal
or narrower scope. Invitation acceptance revalidates the recipient, invitation,
membership and role-version lifecycle, every offered permission, the complete
scope, and a still-current authorised delegator or approver. Any failed check
requires rejection and reissue; authority is never partially accepted.

Protected roles and permissions, self-promotion, wider-scope delegation,
cross-organisation targets, last-owner removal, and bulk migration that would
expand assignees are rejected transactionally and recorded in the Milestone 3
security ledger. Grants are revoked rather than deleted.

## Consequences

- Role edits cannot silently change existing or invited authority.
- Moving assignees to a successor role version is explicit, bounded, and
  auditable.
- Delegation evaluation is more complex and needs transactional positive and
  hostile tests.
- Invitations must preserve exact offered authority and repeat validation at
  acceptance time.
- Only secure-foundation permission keys are introduced in Milestone 3; future
  domain permissions remain with their owning milestones.
