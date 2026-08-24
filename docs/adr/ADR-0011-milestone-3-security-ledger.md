# ADR-0011: Milestone 3 security ledger

## Status

Accepted for Milestone 3 implementation. This ADR is a bounded supplement to
[ADR-0003](ADR-0003-universal-resource-and-shared-capabilities.md); it does not
bring the later generic audit or transactional outbox into Milestone 3.

## Context

Security-sensitive identity, tenant, hierarchy, session, invitation, and RBAC
operations need append-only evidence in the secure tenant foundation. Deferring
all evidence until the generic shared audit capability would leave privileged
paths unaccountable. Implementing the generic resource registry, audit model, or
outbox early would pull unrelated shared-foundation scope into Milestone 3.

## Decision

Create a narrow append-only security ledger only for Milestone 3 security
events. It records, where applicable, organisation, actor user, actor
membership, actor session, action, target type and identifier, outcome, request
correlation, redacted bounded metadata, and time. Unresolved authentication
failures remain platform-level and do not invent an organisation association.

Only controlled operations append events. Ordinary clients cannot update or
delete them. Secrets, passwords, raw invitation tokens, internal login
identifiers, credential material, and unnecessary personal data are prohibited
from metadata.

The later shared audit capability may consume or preserve these records through
an explicit migration decision. It remains distinct from user-facing activity,
domain workflow history, and the transactional outbox.

## Consequences

- Milestone 3 privileged operations and failed attempts have atomic,
  tamper-resistant evidence.
- The ledger has deliberately limited targets and metadata rather than a
  premature universal resource abstraction.
- Generic audit, event delivery, outbox processing, and activity presentation
  remain later work.
- Acceptance must prove append-only privileges, redaction, actor/session
  attribution, unresolved-failure handling, and atomic event creation.
