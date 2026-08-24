# ADR-0003: Universal resource identity and shared capabilities

## Status

Accepted for later shared-foundation implementation; conceptual only in Milestone 1.

## Context

Actions, attachments, comments, workflow history, schedules, Benefits, audit, and events need to relate to records from multiple Lean domains. Duplicating each capability per module creates drift. A free-form `entity_type/entity_id` relation removes referential integrity and makes cross-tenant enforcement fragile. A universal entity-attribute-value model would erase useful domain types.

## Decision

Introduce a narrow future `resource_records` identity registry containing only ID, `organisation_id`, resource type, and creation metadata. Strongly typed domain tables retain business columns, constraints, and lifecycle while referencing their resource identity. Shared records use tenant-safe composite foreign keys.

Build focused shared capabilities around that identity:

- one action domain with tenant, optional source, contextual links, owner/assignee membership, unit, dates, status, priority, optimistic version, and idempotency;
- private attachment metadata and authorised resource links;
- a shared workflow transition protocol and append-only history while domains own states and transition rules;
- append-only audit evidence distinct from user-facing activity;
- an idempotent transactional event outbox distinct from audit;
- deliberate historical snapshots only where wording/context must remain reportable.

## Consequences

- Shared behaviour is reusable without unsafe polymorphic identifiers.
- Domain semantics, constraints, and relational queryability remain explicit.
- Every shared reference must carry and constrain tenant ownership.
- Resource registry lifecycle must remain synchronised with typed records.
- This does not approve a generic workflow designer, arbitrary custom-entity engine, universal temporal data, or speculative tables.
- Universal forms are governed separately by [ADR-0005](ADR-0005-universal-versioned-template-engine.md).

## Related refinements

[ADR-0011](ADR-0011-milestone-3-security-ledger.md) permits a deliberately
narrow append-only ledger for secure-foundation operations. It does not
implement or alter this later generic audit/outbox decision.
