# N1c notification delivery worker

## Status

Implemented in N1c on top of the N1a delivery ledger and N1b notification projector.

## Responsibility

The `notification-delivery` Edge Function is the operational notification delivery
worker. It:

1. claims pending rows from `private.notification_delivery_ledger` through
   `claim_notification_deliveries_for_worker`;
2. resolves delivery context through
   `get_notification_delivery_context_for_worker`;
3. resolves a deliverable recipient contact without exposing synthetic workforce
   authentication identifiers;
4. renders deterministic operational email content by notification kind;
5. sends through Resend using `delivery_key` as the provider idempotency key;
6. records provider acceptance through `complete_notification_delivery_for_worker`
   or classifies failures through the N1a retry/terminal worker RPCs.

N1c ends at **provider acceptance**. It does not implement scheduling, bounce
webhooks, preferences, or notification UI.

## Security boundary

- The worker runs with Supabase `service_role` inside the Edge Function only.
- HTTP callers must present `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- The worker uses only the public `*_for_worker` RPC surface from ADR-0016 plus
  the N1c context wrapper.
- `service_role` is never exposed to Next.js or browser clients.
- Resend credentials remain Edge Function secrets only.

## Recipient resolution policy

Recipient resolution is performed in PostgreSQL through
`get_notification_delivery_context_for_worker` and enforced again in the worker
before send.

| Priority | Source | Use |
| --- | --- | --- |
| 1 | `membership_notification_contacts.contact_address` where `status = 'active'` | Authoritative workforce/import/manual operational contact |
| 2 | `auth.users.email` | Invited standard users with genuine Auth email |
| Never | `*@workforce.invalid`, `*.invalid`, synthetic/internal auth identifiers | Blocked as non-deliverable |

Additional terminal conditions:

- membership `status <> 'active'`
- linked `private.workforce_accounts.status = 'disabled'`
- missing contact
- malformed email address

## Renderer registry

Renderers are registered by immutable `notification_kind`.

| Notification kind | Subject theme | Deep link |
| --- | --- | --- |
| `workforce.job_function_assigned` | Job function assignment updated | `/platform/people` |
| `workforce.training_completed` | Training completion recorded | `/platform/training/courses/{courseId}` when available, else `/platform/training/matrix` |
| `workforce.skill_proficiency_validated` | Skill proficiency validated | `/platform/skills/{skillId}` when available, else `/platform/skills/matrix` |
| `recognition.awarded` | Recognition awarded | `/platform/recognition` |

Implementation lives in:

- `supabase/functions/_shared/notification-delivery/renderer/registry.ts`
- `supabase/functions/_shared/notification-delivery/renderer/renderers.ts`

## Provider adapter

- Production: `ResendOperationalEmailProvider` (`resend@4.8.0`)
- Tests/CI: `FakeOperationalEmailProvider`
- Provider idempotency key: `delivery.delivery_key`
- Payload must remain deterministic across retries

### Immutable provider envelope

Before the first provider send attempt, N1c renders operational email content
and persists an immutable envelope in
`private.notification_delivery_provider_envelopes`. Retries and lease reclaims
reuse this frozen envelope instead of re-resolving live membership/contact/context
data. This guarantees the same `delivery_key` always maps to the same Resend
payload even when source records change after the first preparation.

Worker RPCs:

- `get_notification_delivery_provider_envelope_for_worker`
- `store_notification_delivery_provider_envelope_for_worker`

Resend official idempotency error names handled explicitly:

- `invalid_idempotent_request` → terminal `provider_idempotency_conflict`
- `concurrent_idempotent_requests` → retryable `provider_idempotency_in_flight`

### Resend idempotency retention window

Resend retains idempotency keys for **24 hours**. N1a retry scheduling operates
well inside this window under normal conditions. If a delivery is provider-accepted
but the ledger never records `sent`, and recovery takes longer than 24 hours,
Resend may no longer deduplicate a later resend with the same key. Residual
duplicate-send risk in that edge case is deferred to a later provider
reconciliation/webhook milestone (N1d+).

## Failure classification

| Condition | Worker action |
| --- | --- |
| Network timeout, 429, 5xx, in-flight idempotency conflict | `fail_notification_delivery_retryable_for_worker` |
| Missing deliverable contact, synthetic auth email, invalid email, inactive membership, disabled workforce account, invalid context, render failure, provider auth/config failure, mismatched idempotency payload | `fail_notification_delivery_terminal_for_worker` |
| Provider accepted but completion RPC returns false (lost/stale lease) | Log `fencing_loss_after_provider_accept`; allow N1a reclaim/retry with same frozen envelope |
| Provider accepted but completion RPC errors | `completion_failure_after_provider_accept`; retryable `completion_db_retryable` without reclassifying as provider failure |

## Meaning of `sent`

`sent` means **provider accepted / handoff successful**. It does not mean mailbox
delivery, open, click, or bounce status.

## Required environment variables

Automatically supplied by Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Manually configured Edge Function secrets:

- `RESEND_API_KEY`
- `APP_ORIGIN`
- `OPERATIONAL_EMAIL_FROM`
- `OPERATIONAL_EMAIL_FROM_NAME` (optional)

Auth email secrets remain separate:

- `AUTH_EMAIL_FROM`
- `AUTH_EMAIL_FROM_NAME`
- `SEND_EMAIL_HOOK_SECRET`

## Future scheduler contract

N1c is safely callable but not scheduled. A later slice should invoke:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/notification-delivery" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch_size":10}'
```

## Future webhook/bounce handoff

Provider lifecycle events (delivered, bounced, complained) remain deferred to a
later N1 slice. N1c stores only the initial `provider_message_id`.

## Local verification

```bash
npm run db:start
npm run test:db
npm run test:db:integration:n1b
npm run test:db:integration:n1c
deno check supabase/functions/notification-delivery/index.ts
```

## Hosted deployment (do not execute from N1c)

```bash
supabase db push
supabase secrets set OPERATIONAL_EMAIL_FROM=notifications@example.com
supabase secrets set OPERATIONAL_EMAIL_FROM_NAME="Lean Excellence Hub"
supabase functions deploy notification-delivery --no-verify-jwt
```

## Related

- [ADR-0016](../adr/ADR-0016-n1a-reliable-notification-outbox-and-delivery-ledger.md)
- [N1b notification projection worker](notification-projection-worker.md)
