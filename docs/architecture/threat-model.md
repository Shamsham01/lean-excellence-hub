# Threat model

## Status and method

This architecture-stage threat model identifies trust assumptions and required
controls, including the approved Milestone 3 secure-tenant boundary. It does not
claim those controls are implemented. Reassess it whenever a milestone changes
data flows or privileged paths.

## Assets and actors

Protected assets include credentials and sessions; organisation membership and hierarchy; personal/workforce data; Lean records and evidence; private files; Benefit financial values; immutable template and revision history; audit evidence; API/export data; and service credentials.

Actors include anonymous visitors, authenticated members, organisation administrators, platform operators, controlled workers, external API clients, and malicious or compromised users in another organisation.

## Principal threats and treatments

### Cross-organisation disclosure or mutation — critical

Attackers manipulate identifiers, route organisation, joins, references, Storage paths, views, exports, or future APIs. Required treatment: database-current membership, default-deny RLS on every exposed tenant table, composite tenant foreign keys, tenant-leading indexes, caller-scoped clients, private helpers, authorised metadata plus signed Storage access, and multi-tenant adversarial tests.

### Role or scope escalation — critical

Attackers edit user metadata, forge organisation selection, reuse a revoked
session's unexpired JWT, self-grant roles, expand mutable roles, exploit
hierarchy ambiguity, or call privileged operations. Required treatment:
session-bound PostgreSQL context, live Auth session and lifecycle checks, no
authorisation from user-editable metadata or organisation claims, immutable
role-version grants, contained delegation, transactional hierarchy operations,
re-authorisation, and narrow security evidence around privileged paths.

### Workforce account enumeration and credential attack — high

Organisation codes, workforce aliases, internal Auth identifiers, error timing,
reset flows, or login attempts reveal accounts or enable stuffing. Required
treatment: trusted server-side normalised resolution, pre-authentication
identifier non-disclosure, equivalent failures, layered hashed throttling,
stewardship-aware recovery, disabling, session revocation, and future MFA.
Owner-only post-authentication identifier disclosure and consequent direct
Supabase sign-in are accepted residual risks; Supabase Auth throttling remains
mandatory and Supabase Auth alone verifies passwords.

### Delegation and invitation authority drift — critical

Mutable roles, stale delegator access, or partially accepted invitations can
expand authority after issue. Required treatment: exact immutable role-version
and scope binding, complete issue-time and acceptance-time containment,
lifecycle revalidation, transactional rejection, protected-role and last-owner
invariants, and explicit audited migration between versions.

### Session context and lifecycle confusion — critical

Concurrent sessions, stale selection, pending invitations, disabled identities,
or suspended organisations can be mistaken for active access. Required
treatment: one context per matching Auth session and user, invitations separate
from memberships, fail-closed active-state checks, session revocation, and no
tenant access when the matching Auth session row is absent.

### Sensitive financial or personal data leakage — high

Broad selects, views, generated APIs, exports, audit payloads, logs, or analytics reveal restricted fields. Required treatment: separate financial records and permission, minimal schemas, `security_invoker` views, redacted audit, permission-aware exports/search, logging rules, and independent policy tests.

### Broken shared-resource references — high

Free-form polymorphic links connect an action, attachment, comment, or Benefit to another organisation's record. Required treatment: narrow resource registry, `organisation_id` on shared records, composite foreign keys, and transaction-level reference checks.

### Upload and object abuse — high

Users upload active content, malware, oversized files, spoofed MIME, or guess object paths. Required treatment: private buckets, server-issued organisation-prefixed identities, size/type validation, metadata authorisation, short-lived signed access, scanning-state seam, quarantine before later scanning, and audit.

### History tampering and reporting fraud — high

Users edit published templates, Benefit forecasts after validation, realisations, transitions, or audit. Required treatment: immutable published versions and revisions, exact-version references, append-only validation/realisation/history/audit, separation of duties, transactional publication, and database enforcement.

### Retry, concurrency, and event faults — medium

Duplicate requests create duplicate actions or value; concurrent edits overwrite; events are lost or replayed. Required treatment: client idempotency keys, optimistic versions, transactional use-cases, idempotent outbox consumers, and observable retry/dead-letter handling when consumers exist.

For Milestone 3 specifically, concurrent hierarchy moves or lifecycle changes
can corrupt closure paths or retain access. Organisation-scoped locking,
affected-row locks, bounded depth, atomic adjacency/closure replacement,
optimistic versions where appropriate, and complete rollback are required.
Generic outbox delivery remains later scope.

### Privileged worker or secret compromise — critical

Service-role credentials bypass RLS or leak through code, logs, CI, or browser bundles. Required treatment: no secrets in version control or client code, least-privilege environment separation, isolated server-only workers, explicit target re-authorisation, credential rotation, operation audit, and privileged-path tests.

### Import, export, API, webhook, and AI boundary failure — high

Later batch or machine paths bypass interactive checks, ingest hostile data, over-export, forge callbacks, or leak tenant context into models. Required treatment: same use-cases and permissions, staged validation, quotas, signatures, idempotency, scoped service identities, output filtering, audit, and tenant-isolated AI context. These paths remain unimplemented.

### Availability and abuse — medium

Authentication resolution, expensive reports, deep hierarchy queries, uploads, or public endpoints are exhausted. Required treatment: rate limits, bounded inputs, tenant-leading indexes, query-plan review, quotas/timeouts, background processing where justified, and monitoring.

### Retention and deletion error — high

Auth deletion, universal soft-delete, or an administrator action removes required management history or retains data indefinitely. Required treatment: aggregate-specific lifecycle and retention decisions, historical actor preservation, controlled anonymisation/deletion, legal review where applicable, and auditable operations.

## Residual risks and assumptions

Supabase and Microsoft controls remain external dependencies. A live Microsoft
round trip is not Milestone 3 acceptance evidence; the provider-neutral PKCE,
redirect, allowlist, verified-identity, and collision boundaries are. RLS
correctness depends on complete coverage and query-aware indexes. Future Storage
and malware scanning, MFA, enterprise integrations, exports, generic
audit/outbox, retention operations, and offline queues remain later seams.
Configurability increases authorisation and reporting complexity and must pass
the [16-question rule](platform-architecture.md#16-question-architectural-decision-rule).

## Review gates

Milestone 3 cannot be accepted without hostile two-tenant tests, session and
lifecycle denial, delegation containment, hierarchy rollback/concurrency,
workforce anti-enumeration and disclosure, recovery, and narrow append-only
security-ledger evidence. Storage, exports, Benefits/financial permissions,
template publication, generic audit/outbox, and event-idempotency tests move to
their owning milestones. Every later external or AI path requires a
threat-model update before implementation.
