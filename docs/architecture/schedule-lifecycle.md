# Schedule lifecycle

## Status

Phase 1 for Issue #93. Lean Excellence Hub remains the system of record.
There is no bidirectional Google/Microsoft calendar sync and no OAuth calendar
provider integration.

## Definitions and occurrences

`schedule_definitions` is the definition system of record. Activity
(`activity_resource_id`) is create-only and cannot change on update.

`schedule_occurrences` are materialised instances. Unique identity is
`(organisation, definition, planned_local_date, coalesce(local_time, 00:00))`.

Timezone is stored on the definition from the organisation timezone at create
time. It is not rewritten on edit. Local dates and `planned_at` use
`timestamp AT TIME ZONE <definition.timezone>`, so DST transitions follow the
IANA zone named on the definition.

## Edit semantics

`update_schedule_definition` is active-only. It:

1. updates definition fields except activity resource;
2. cancels **future open** occurrences (`planned_local_date >= today` in the
   definition timezone);
3. rematerialises the 90-day horizon via `ensure_schedule_occurrences`.

`ensure_schedule_occurrences` inserts missing matching dates. When a cancelled
future row occupies the same unique slot and has no completion, it is reopened
and refreshed. Completed rows and past cancelled rows are left alone.

Past open rows are not cancelled by update. Historical completed occurrences
keep their identity, completion link, and planned date.

## Inactive lifecycle

Inactive is a pause, not a terminal retirement.

- `deactivate_schedule_definition` sets `inactive`, bumps `version_number`,
  and cancels future open occurrences.
- `reactivate_schedule_definition` requires `inactive`, re-checks activity
  unit applicability, sets `active`, rematerialises the 90-day horizon, and
  preserves historical completed/cancelled rows.
- There is no Delete RPC. Retention of history is intentional.

## Reminder policy

Morning-of reminders for **open** occurrences on **active** definitions where
`planned_local_date` equals today in the definition timezone.

Recipients are the owner plus current participants. Events are
`ScheduleOccurrenceReminderDue` with idempotency key
`schedule-occurrence-reminder:{occurrence_id}:morning-of`. The existing
projector and delivery workers resolve `membership_notification_contacts`.

The sweep runs from `private.invoke_notification_projector_worker()` before
the projector claim, and can also be invoked for the current organisation
through `enqueue_due_schedule_occurrence_reminders`.

Update now emits `ScheduleUpdated` (previously audit-only). Reminders do not
depend on that event.

## Calendar Phase 1

Authenticated download of a standards-compliant `.ics` calendar from
`/platform/schedule/{id}/calendar`, optionally scoped with `occurrenceId`.
LEH remains the system of record. Files contain title, dates, timezone, UID,
and a relative schedule path. They do not include secrets or contact emails.
