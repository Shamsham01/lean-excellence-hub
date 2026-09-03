# N1d/S2d Notification Scheduling and Suggestion Feedback Runbook

## Migrations (apply in order after hosted approval)

1. `20260903110000_s2d_suggestion_feedback_notifications.sql`
2. `20260903120000_n1d_notification_worker_scheduling.sql`

## Extensions expected on hosted Supabase

- `pg_cron` (schema `pg_catalog`)
- `pg_net` (schema `extensions`)
- `supabase_vault` (schema `vault`)

## Scheduler architecture

- `pg_cron` invokes `private.invoke_notification_projector_worker()` and `private.invoke_notification_delivery_worker()` once per minute.
- Each invoke function reads non-secret settings from `private.notification_worker_scheduler_settings` and performs `net.http_post` to Edge Functions:
  - `/functions/v1/notification-projector`
  - `/functions/v1/notification-delivery`
- Authentication uses the `apikey` header with a Vault secret (not embedded in SQL or migrations).

## Worker endpoint auth model

Both workers accept:

- `apikey: <server secret>` from `SUPABASE_SECRET_KEYS` JSON (preferred)
- `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (legacy fallback)

Unauthenticated or incorrect credentials return `401`.

## Hosted Vault secret provisioning (manual — do not commit values)

Create secrets in Supabase Vault with these **names only**:

| Vault secret name | Purpose |
|---|---|
| `leh_supabase_project_url` | Project API origin, e.g. `https://<project-ref>.supabase.co` |
| `leh_notification_worker_secret` | Server secret key (`sb_secret_...`) permitted to invoke workers |

Never paste secret values into SQL migrations or Git.

## Verify cron jobs (hosted SQL)

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'leh_notification_projector_every_minute',
  'leh_notification_delivery_every_minute'
);
```

## Operational health

```sql
select * from private.notification_operational_health();
```

Healthy indicators:

- `scheduler_enabled = true`
- projector/delivery cron job counts = 1 each and `active`
- post-cutover pending outbox age trending down after new events
- `needs_remediation_delivery_count` not growing unexpectedly
- `pre_cutover_skip_count` stable (audit record only)

## Historical backlog cutover

- Shared `private.domain_event_outbox` remains unchanged for other consumers.
- Notification projector uses `private.notification_projector_consumer_state.cutover_at` (set at migration time).
- `private.claim_domain_events_for_notification_projector` only claims events with `created_at >= cutover_at`.
- Pre-cutover pending events are recorded in `private.notification_projector_pre_cutover_skips` with `skip_reason = 'pre_cutover_backlog'`.
- Outbox rows are **not** deleted and are **not** marked processed by the notification consumer.

## Disable / re-enable scheduler

```sql
select private.set_notification_worker_scheduler_enabled(false);  -- disable
select private.set_notification_worker_scheduler_enabled(true);   -- re-enable
```

Or unschedule cron jobs:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'leh_notification_projector_every_minute',
  'leh_notification_delivery_every_minute'
);
```

## Deploy Edge Functions (manual after approval)

```bash
supabase functions deploy notification-projector --no-verify-jwt
supabase functions deploy notification-delivery --no-verify-jwt
```

Ensure function secrets include `SUPABASE_SECRET_KEYS` and/or `SUPABASE_SERVICE_ROLE_KEY`, plus delivery provider secrets for `notification-delivery`.

## Production smoke plan (post-cutover only)

1. Create a **new** suggestion after migration/cutover.
2. Assign reviewer; **do not** manually invoke workers.
3. Verify projector consumes outbox event automatically within ~1–2 minutes.
4. Verify delivery ledger row created automatically.
5. Verify reviewer assignment email arrives.
6. Request more information with employee feedback; verify proposer email.
7. Approve/decline/park with employee feedback; verify email contains feedback, not internal rationale.
8. Complete suggestion with employee outcome; verify completion email.
9. Verify **no** email for review started.
10. Run `select * from private.notification_operational_health();` and confirm queues return healthy.

## Latency expectation

Minute-level scheduling: projector and delivery each run approximately once per minute. Delivery may lag projector by up to one cycle; this is expected.
