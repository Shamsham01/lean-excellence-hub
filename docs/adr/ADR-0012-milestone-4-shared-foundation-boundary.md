# ADR-0012: Milestone 4 shared-foundation boundary

## Status

Accepted for Milestone 4 implementation. This ADR supplements
[ADR-0003](ADR-0003-universal-resource-and-shared-capabilities.md),
[ADR-0005](ADR-0005-universal-versioned-template-engine.md), and
[ADR-0011](ADR-0011-milestone-3-security-ledger.md).

## Context

Milestone 3 delivered the secure tenant foundation. Milestone 4 must introduce
reusable shared platform capabilities without weakening tenancy, RBAC, or RLS,
and without starting Lean domain modules.

## Decision

Implement the shared foundation with these boundaries:

### Resource identity

- `resource_records` is a narrow identity registry; not a browseable catalogue
  for ordinary clients.
- Typed domain tables share primary keys with registry rows.
- Cross-resource references use composite tenant foreign keys.

### Target-resource authorisation

Shared capabilities (attachments, comments, action sources) require both the
shared-capability permission and typed authorisation to the referenced target
resource via `private.can_access_resource(...)`.

### Existing-tenant permission upgrade

New permission keys are seeded in migrations. Existing protected owner roles
receive them through a successor published role version. Historical role versions
are not mutated.

### Audit and events (four concerns, four artefacts)

| Concern | Artefact | Client exposure |
|---|---|---|
| Security audit | `security_audit_events` | authorised read only |
| Business audit | `business_audit_events` | default-deny read |
| Domain events | `private.domain_event_outbox` | not exposed |
| User activity | not implemented | future outbox consumer |

### Universal actions

One action domain with fixed status semantics, append-only transition history,
scoped visibility, and source-resource validation. No workflow designer.

### Versioned templates

Immutable published versions; submissions with `draft -> completed` lifecycle;
`allows_not_applicable` on questions; relational `template_answer_people` for
person answers.

### Attachments

Two-phase upload (`pending_upload -> active`); server-generated paths;
re-authorisation on confirm and download; `scan_state = not_required` in M4.

### Comments

Shared comment primitive with target-resource authorisation.

### Authenticated shell

Responsive platform shell with permission-aware navigation for implemented
capabilities only.

## Explicit non-goals

- Lean domain modules (5S, Gemba, Maturity, Projects, etc.)
- User-facing activity feed, notifications, webhooks
- Visual workflow designer
- Malware scanning infrastructure
- Business audit read UI (schema remains default-deny)
- Remote Supabase migration application during Milestone 4 implementation

## Consequences

- Future Lean modules consume shared primitives instead of duplicating them.
- Milestone 3 security regression tests must continue passing.
- Enabling Azure OAuth, Milestone 5, or hosted migration push requires separate
  approval.
