# Security model

## Status and security objective

This Milestone 1 document defines the target controls; it does not claim they are implemented. The primary objective is default-deny isolation between organisations while preserving scoped access, historical accountability, and safe frontline authentication.

## Trust boundaries

Untrusted inputs include browsers, route parameters, organisation selection, user metadata, JWT display hints, uploaded content, import files, future API clients, webhook payloads, and AI-generated content. Trusted components are narrowly scoped server-side use-cases, PostgreSQL constraints and RLS, private authorisation helpers, Supabase Auth, and controlled privileged workers.

Supabase Auth is the only credential and password authority. Lean Hub never stores password hashes or creates a parallel credential system.

## Authentication and workforce resolution

Future entry methods are:

1. Microsoft identity for corporate users;
2. email and password where appropriate;
3. organisation code plus workforce ID/username plus password for users without corporate email.

Microsoft and email identities map to current organisation memberships. Workforce login uses rate-limited trusted server-side logic to normalise and resolve organisation code plus workforce identifier to a non-public Supabase Auth login identifier, then delegates password verification to Supabase Auth. Browsers receive generic failures and cannot enumerate organisations, workforce accounts, internal login identifiers, or memberships.

Membership identity is organisation-specific and separate from global Auth identity. Planned controls include administrator reset, forced initial password change, disabling, failed-attempt throttling, generic responses, audit events, session revocation, and a future MFA seam. Full implementation is deferred to Milestone 3.

See [ADR-0004](../adr/ADR-0004-workforce-authentication.md).

## Authorisation and RLS

- Current database membership, not `raw_user_meta_data` or stale JWT roles, is authoritative.
- Organisation route selection is context only; every operation proves access to the row's `organisation_id`.
- Stable permissions are granted through organisation roles at self, unit-subtree, or organisation scope.
- Organisation lifecycle and active membership are checked centrally as part of authorisation.
- Every exposed tenant table enables RLS immediately with explicit default-deny `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies. Updates require the row to be selectable and the new row to satisfy checks.
- Narrow authorisation helpers live in an unexposed private schema. Any security-definer helper sets a safe `search_path`, is non-user-writable, and never lives in an exposed schema.
- Exposed views use `security_invoker`.
- Composite tenant foreign keys reject cross-organisation references even when application checks fail.

Application use-cases normally use caller-scoped clients. Service-role access is exceptional: isolate the path, re-authorise the actor and target, minimise scope, audit it, and adversarially test it.

## Data protection

- Financial Benefit values are separated from broadly visible descriptive rows and require `benefits.view_financial`.
- Storage buckets are private. Server-generated object paths start with organisation identity; metadata and signed-object access are both authorised.
- Upload controls define MIME and size limits plus a future quarantine/scanning state. Scanning infrastructure is not part of Milestone 1.
- Audit before/after content is redacted and minimised; secrets and credential material are never logged.
- Exports, search, APIs, imports, analytics, and future AI paths apply the same tenant and permission checks as interactive reads.
- Environment secrets remain outside version control; client code receives publishable values only.

## Integrity, accountability, and availability

Critical history is append-only. Database triggers may protect row-level evidence while application events provide business meaning. Correlation/request identifiers connect actions, audit, and events. Idempotency keys and optimistic versions mitigate retry and concurrency faults.

Rate limits apply to authentication resolution, resets, invitations, expensive exports, and future public APIs. Session revocation follows account, membership, tenant, and administrator security events. Monitoring must detect repeated authentication failures, cross-tenant denials, privileged operations, export abuse, and outbox failures without leaking sensitive values.

## Required security evidence for later milestones

Use at least two organisations and identities with active, inactive, multiple, and no memberships. Test cross-tenant read, write, reference, Storage, export, and role-escalation denial; hierarchy scope; suspended organisations; financial permissions; privileged paths; workforce anti-enumeration; session revocation; immutable published versions; append-only audit; and event idempotency.

Entitlements remain commercial controls and cannot weaken these requirements.
