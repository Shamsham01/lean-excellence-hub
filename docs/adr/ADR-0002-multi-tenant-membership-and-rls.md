# ADR-0002: Multi-tenant membership and RLS

## Status

Accepted for Milestone 3 implementation; conceptual only in Milestone 1.

## Context

People may belong to several organisations, organisation hierarchies vary in depth, and access can apply to self, a unit subtree, or an entire organisation. Route selection, user-editable metadata, and stale token claims cannot safely establish tenant access. Application checks alone cannot protect generated APIs, joins, or future machine paths.

## Decision

Separate global Auth identity and profile from organisation-specific membership. Authorise against current active membership, stable permission definitions, scoped grants, organisation lifecycle, and row `organisation_id` in PostgreSQL.

Every exposed tenant row carries `organisation_id` and a composite uniqueness target. Composite foreign keys prevent cross-tenant references. Organisation units use adjacency plus a transactionally maintained closure table. Grants use `self`, `unit_subtree`, or `organisation` scope rather than fixed site/department engines.

Enable default-deny RLS immediately on every exposed table for all operations. Put narrow membership, permission, scope, and lifecycle helpers in an unexposed private schema. Security-definer helpers set a safe `search_path`, remain non-user-writable, and never live in an exposed schema. Exposed views use `security_invoker`. Tenant-leading indexes support policy predicates.

The chosen organisation in the route or UI is context only. Do not authorise from `raw_user_meta_data`, an active-organisation JWT claim, or cached role claims.

## Consequences

- Multi-organisation users and variable hierarchy depth are first-class.
- Database enforcement protects interactive and machine access consistently.
- Composite keys and RLS add migration and testing discipline.
- Updates must satisfy both row visibility and new-row checks.
- Service-role paths bypass RLS and therefore require isolation, re-authorisation, audit, and adversarial tests.
- Milestone 3 acceptance requires hostile two-tenant, hierarchy, inactive-membership, suspended-organisation, cross-reference, export, Storage, and role-escalation tests.
