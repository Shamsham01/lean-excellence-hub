# Threat model

## Status and method

This architecture-stage threat model identifies trust assumptions and required future controls. No application, database, or security controls are implemented in Milestone 1. Reassess it whenever a milestone changes data flows or privileged paths.

## Assets and actors

Protected assets include credentials and sessions; organisation membership and hierarchy; personal/workforce data; Lean records and evidence; private files; Benefit financial values; immutable template and revision history; audit evidence; API/export data; and service credentials.

Actors include anonymous visitors, authenticated members, organisation administrators, platform operators, controlled workers, external API clients, and malicious or compromised users in another organisation.

## Principal threats and treatments

### Cross-organisation disclosure or mutation — critical

Attackers manipulate identifiers, route organisation, joins, references, Storage paths, views, exports, or future APIs. Required treatment: database-current membership, default-deny RLS on every exposed tenant table, composite tenant foreign keys, tenant-leading indexes, caller-scoped clients, private helpers, authorised metadata plus signed Storage access, and multi-tenant adversarial tests.

### Role or scope escalation — critical

Attackers edit user metadata, reuse stale JWT claims, self-grant roles, exploit hierarchy ambiguity, or call privileged operations. Required treatment: no authorisation from user-editable metadata or active-organisation claims; stable permissions and scoped grants in PostgreSQL; controlled role administration; lifecycle checks; re-authorisation and audit around all service-role paths.

### Workforce account enumeration and credential attack — high

Organisation codes, workforce identifiers, internal Auth identifiers, error timing, reset flows, or login attempts reveal accounts or enable stuffing. Required treatment: trusted server-side normalised resolution, non-public Auth identifiers, generic responses, uniform handling, layered throttling, audit and alerting, administrator reset, forced initial change, disabling, session revocation, and future MFA. Supabase Auth alone verifies passwords.

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

### Privileged worker or secret compromise — critical

Service-role credentials bypass RLS or leak through code, logs, CI, or browser bundles. Required treatment: no secrets in version control or client code, least-privilege environment separation, isolated server-only workers, explicit target re-authorisation, credential rotation, operation audit, and privileged-path tests.

### Import, export, API, webhook, and AI boundary failure — high

Later batch or machine paths bypass interactive checks, ingest hostile data, over-export, forge callbacks, or leak tenant context into models. Required treatment: same use-cases and permissions, staged validation, quotas, signatures, idempotency, scoped service identities, output filtering, audit, and tenant-isolated AI context. These paths remain unimplemented.

### Availability and abuse — medium

Authentication resolution, expensive reports, deep hierarchy queries, uploads, or public endpoints are exhausted. Required treatment: rate limits, bounded inputs, tenant-leading indexes, query-plan review, quotas/timeouts, background processing where justified, and monitoring.

### Retention and deletion error — high

Auth deletion, universal soft-delete, or an administrator action removes required management history or retains data indefinitely. Required treatment: aggregate-specific lifecycle and retention decisions, historical actor preservation, controlled anonymisation/deletion, legal review where applicable, and auditable operations.

## Residual risks and assumptions

Supabase and Microsoft controls remain external dependencies. RLS correctness depends on complete coverage and query-aware indexes. Future malware scanning, MFA, enterprise integrations, retention operations, and offline queues are seams rather than present controls. Configurability increases authorisation and reporting complexity and must pass the [16-question rule](platform-architecture.md#16-question-architectural-decision-rule).

## Review gates

Milestone 3 cannot be accepted without hostile two-tenant tests and workforce anti-enumeration evidence. Shared-capability milestones additionally require cross-tenant reference and Storage denial, immutable publication, append-only evidence, concurrency, and idempotency tests. Every later external or AI path requires a threat-model update before implementation.
