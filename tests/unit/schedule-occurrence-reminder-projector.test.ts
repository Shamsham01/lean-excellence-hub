import { describe, expect, it } from "vitest";

import {
  SCHEDULE_OCCURRENCE_REMINDER_KIND,
  projectScheduleOccurrenceReminder,
} from "../../supabase/functions/_shared/notification-projector/projectors/schedule-occurrence-reminder.ts";
import type { ClaimedDomainEvent } from "../../supabase/functions/_shared/notification-projector/types.ts";

const EVENT: ClaimedDomainEvent = {
  organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  resourceRecordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  eventType: "ScheduleOccurrenceReminderDue",
  payload: {
    recipient_membership_ids: [
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    ],
  },
  leaseToken: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  attemptCount: 1,
};

describe("schedule occurrence reminder projector", () => {
  it("projects unique owner/participant recipients onto the canonical kind", () => {
    const outcome = projectScheduleOccurrenceReminder(EVENT);
    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(2);
    expect(
      outcome.intents.every(
        (intent) =>
          intent.notificationKind === SCHEDULE_OCCURRENCE_REMINDER_KIND,
      ),
    ).toBe(true);
    expect(
      new Set(outcome.intents.map((intent) => intent.deliveryKey)).size,
    ).toBe(2);
  });
});
