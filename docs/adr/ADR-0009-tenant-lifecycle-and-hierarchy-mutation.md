# ADR-0009: Tenant lifecycle and hierarchy mutation

## Status

Accepted for Milestone 3 implementation. This ADR supplements
[ADR-0002](ADR-0002-multi-tenant-membership-and-rls.md).

## Context

Organisation, membership, identity, invitation, role, grant, and unit states
directly affect access. Ad hoc updates can leave stale sessions, orphaned
authority, or ambiguous history. Maintaining adjacency and closure rows in
separate statements can create cycles, cross-organisation paths, or partially
moved subtrees under failure or concurrency.

## Decision

Use explicit lifecycle states and controlled transitions:

- organisations move through `provisioning`, `active`, `suspended`, and
  `closed`;
- memberships move through `pending`, `active`, and `inactive`, where
  `pending` exists only after an Auth user is bound but before acceptance or
  enrolment completes;
- invitations are separate, non-authorising records with `pending`,
  `accepted`, `revoked`, or `expired` lifecycle;
- identities, workforce accounts, roles, role versions, grants, and units use
  aggregate-specific active, disabled, retired, archived, revoked, or restored
  transitions rather than a universal soft-delete rule.

Only active identities, organisations, and memberships authorise normal tenant
access. Security-relevant transitions capture actor, reason, and time, revoke
affected sessions where required, and preserve historical references.

Unit creation, move, retirement, and restoration use controlled transactions.
They take an organisation-scoped advisory lock, lock affected units and closure
rows, reject cross-organisation parents, cycles, and descendants as new
parents, enforce a defensive maximum depth, and update adjacency plus all
closure paths atomically. Failure rolls back the complete mutation. A deliberate
forest of top-level units is supported.

## Consequences

- Invitations cannot accidentally grant access before identity binding and
  acceptance.
- Direct lifecycle and closure-table mutation must be denied to ordinary
  clients.
- Hierarchy operations serialise per organisation and may reduce concurrency
  in exchange for deterministic integrity.
- Acceptance evidence must cover every allowed transition, stale-session
  denial, failed rollback, concurrent moves, cycle and cross-tenant rejection,
  retirement, restoration, and depth limits.
