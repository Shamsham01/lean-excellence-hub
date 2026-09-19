import { buildDeliveryKey } from "../delivery-key.ts";
import { TerminalProjectionError } from "../errors.ts";
import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";

export const SCHEDULE_OCCURRENCE_REMINDER_EVENT =
  "ScheduleOccurrenceReminderDue";
export const SCHEDULE_OCCURRENCE_REMINDER_KIND = "schedule.occurrence_reminder";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readRecipientMembershipIds(event: ClaimedDomainEvent): string[] {
  const rawValue = event.payload.recipient_membership_ids;
  if (!Array.isArray(rawValue) || rawValue.length === 0) {
    throw new TerminalProjectionError(
      "invalid_payload",
      "ScheduleOccurrenceReminderDue payload must include recipient_membership_ids",
    );
  }

  const recipients = rawValue
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => UUID_PATTERN.test(value));

  const unique = [...new Set(recipients)];
  if (unique.length === 0) {
    throw new TerminalProjectionError(
      "invalid_payload",
      "ScheduleOccurrenceReminderDue payload recipient_membership_ids must contain UUIDs",
    );
  }

  return unique;
}

export function projectScheduleOccurrenceReminder(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  if (!event.resourceRecordId || !UUID_PATTERN.test(event.resourceRecordId)) {
    throw new TerminalProjectionError(
      "invalid_payload",
      "ScheduleOccurrenceReminderDue requires resource_record_id occurrence UUID",
    );
  }

  return {
    kind: "project",
    intents: readRecipientMembershipIds(event).map((recipientMembershipId) => ({
      recipientMembershipId,
      notificationKind: SCHEDULE_OCCURRENCE_REMINDER_KIND,
      deliveryKey: buildDeliveryKey(
        SCHEDULE_OCCURRENCE_REMINDER_KIND,
        event.eventId,
        recipientMembershipId,
      ),
    })),
  };
}
