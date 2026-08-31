# ADR-0016: N1a reliable notification outbox and delivery ledger

## Status

Accepted for N1a implementation.

## Context

Milestone 4 introduced `private.domain_event_outbox` with basic pending/processing/processed/failed
states. Domain producers already enqueue events transactionally from authoritative operations.
Notification delivery (email via Resend, contacts, preferences, and UI) is deferred to later
milestones, but workers need reliable, tenant-safe primitives before any provider integration.

## Decision

### Separation of concerns

| Concern | Artefact | Meaning of completion |
|---|---|---|
| Domain projection | `private.domain_event_outbox` | Event observed and downstream ledger rows created; `processed_at` marks projection handled |
| Notification delivery | `private.notification_delivery_ledger` | Provider hand-off recorded; `sent_at` marks provider acceptance |

The outbox does **not** store email addresses, rendered content, or `delivered_at`. The delivery
ledger does **not** duplicate event payloads.

### Lease model and fencing

Workers claim rows with `FOR UPDATE SKIP LOCKED`. Each claim:

- sets `processing_started_at` and `lease_expires_at`;
- assigns a unique `lease_token`;
- increments `attempt_count` once (one processing attempt).

`complete_*`, `fail_*_retryable`, and `fail_*_terminal` require the **current** `lease_token`.
Stale or missing tokens are rejected without mutation (returns `false`). Expired `processing` leases
are reclaimable on the next claim.

### Retry schedule

Deterministic bounded exponential backoff via `private.reliable_processing_retry_delay()`:

| Attempt (after claim) | Retry delay |
|---|---|
| 1 | 60 seconds |
| 2 | 120 seconds |
| 3 | 240 seconds |
| 4 | 480 seconds |
| 5+ | terminal failure |

Maximum attempts: **5** for both outbox projection and delivery (`*_max_attempts()` helpers).
No random jitter in database logic.

Outbox terminal state: `failed`. Delivery terminal state: `needs_remediation` (not auto-claimable).

### Idempotency

- **Outbox:** `(organisation_id, idempotency_key)` unique; `enqueue_domain_event` unchanged for producers.
- **Delivery ledger:** `(organisation_id, delivery_key)` unique; `create_notification_delivery` returns
  the existing row on conflict.

`delivery_key` is an immutable, stable key for a single logical notification. N1c will derive
Resend `Idempotency-Key` from `delivery_key` (provider idempotency is separate from DB uniqueness).

### Delivery creation guards

`create_notification_delivery` requires:

- source domain event exists and matches `organisation_id`;
- recipient membership exists in the same organisation;
- cross-tenant linkage raises an exception.

Duplicate `delivery_key` is handled deterministically (existing id returned).

### Security

- Both tables live in `private` with RLS forced; only `lean_hub_private_owner` has DML.
- Worker RPCs (`claim_*`, `complete_*`, `fail_*`, `create_notification_delivery`) are granted to
  `service_role` only; revoked from `anon` and `authenticated`.
- `enqueue_domain_event` remains producer-only (not granted to `service_role`).

### N1a non-goals

No Resend integration, notification contacts/preferences, Actions events, cron/reminders, UI, or
external side effects. Workers are not implemented in this milestone.

## Consequences

- Existing domain producers continue to call `enqueue_domain_event` without change.
- In-flight `processing` outbox rows are reset to `pending` during migration.
- `mark_domain_event_processed` now requires `expected_lease_token` for compatibility with the new
  fencing model.
- N1b+ can implement projection and delivery workers against these primitives.

## Related

- [ADR-0012](ADR-0012-milestone-4-shared-foundation-boundary.md)
- [ADR-0014](ADR-0014-workforce-provisioning-and-notification-foundation.md)
