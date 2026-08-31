# N1b notification projection worker

## Status

Implemented in N1b on top of the N1a outbox and delivery ledger primitives.

## Responsibility

The `notification-projector` Edge Function is the domain-event projection worker for
operational notifications. It:

1. claims eligible rows from `private.domain_event_outbox` through the public
   `claim_domain_events_for_worker` RPC;
2. resolves supported events through a registry of deterministic projectors;
3. creates `private.notification_delivery_ledger` rows through
   `create_notification_delivery_for_worker`;
4. completes or fails the source outbox event through the N1a worker RPCs.

N1b does **not** send email, resolve notification contacts, apply preferences, or
invoke Resend. That is deferred to N1c.

## Security boundary

- The worker runs with Supabase `service_role` inside the Edge Function only.
- HTTP callers must present `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- The worker uses only the public `*_for_worker` RPC surface from ADR-0016.
- Lease, retry, and fencing semantics remain in PostgreSQL; TypeScript does not
  reimplement them.
- `service_role` is never exposed to Next.js or browser clients.

## Projector registry

Projectors are registered by immutable `event_type` string. Each projector is
tenant-aware, deterministic, and idempotent.

| Event type | Notification kind | Recipient resolution |
| --- | --- | --- |
| `JobFunctionAssigned` | `workforce.job_function_assigned` | `payload.membership_id` |
| `TrainingCompleted` | `workforce.training_completed` | `payload.membership_id` |
| `SkillProficiencyValidated` | `workforce.skill_proficiency_validated` | `payload.membership_id` |
| `RecognitionAwarded` | `recognition.awarded` | all rows in `recognition_recipients` for `resource_record_id` |

Implementation lives in:

- `supabase/functions/_shared/notification-projector/registry.ts`
- `supabase/functions/_shared/notification-projector/projectors/*`

## Delivery key scheme

Each logical notification uses a stable delivery key derived only from immutable
identity:

```text
{notification_kind}:{source_domain_event_id}:{recipient_membership_id}
```

The ledger enforces uniqueness on `(organisation_id, delivery_key)`. Reusing the
same key with the same immutable identity returns the existing row. Reusing the
same key with a different identity raises a deterministic error.

## Unsupported event policy

If no projector is registered for an claimed `event_type`, the worker completes
the outbox event without creating deliveries. This is an intentional no-op, not a
silent failure.

## Failure classification

| Condition | Worker action |
| --- | --- |
| Transient RPC/network/database failure while creating deliveries | `fail_domain_event_retryable_for_worker` |
| Malformed payload, missing references, tenant mismatch, conflicting delivery identity | `fail_domain_event_terminal_for_worker` |
| Unsupported event type | `complete_domain_event_for_worker` with zero deliveries |

Malformed notification-capable events are never dropped silently.

## N1c handoff

N1c will implement the delivery worker against:

- `claim_notification_deliveries_for_worker`
- `complete_notification_delivery_for_worker`
- `fail_notification_delivery_*_for_worker`

N1b leaves all ledger rows in `pending` status for N1c to claim.

## Local verification

```bash
npm run db:start
npm run test:db
npm run test:db:integration:n1b
deno check supabase/functions/notification-projector/index.ts
```

## Hosted deployment (do not execute from N1b)

```bash
supabase functions deploy notification-projector --no-verify-jwt
```

Configure the function with the standard Supabase Edge secrets (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`). Invoke it from a trusted scheduler using the service
role bearer token.

## Related

- [ADR-0016](../adr/ADR-0016-n1a-reliable-notification-outbox-and-delivery-ledger.md)
- [ADR-0014](../adr/ADR-0014-workforce-provisioning-and-notification-foundation.md)
