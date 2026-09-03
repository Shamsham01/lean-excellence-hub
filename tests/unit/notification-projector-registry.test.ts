import { describe, expect, it } from "vitest";

import {
  JOB_FUNCTION_ASSIGNED_KIND,
  projectJobFunctionAssigned,
} from "../../supabase/functions/_shared/notification-projector/projectors/job-function-assigned.ts";
import {
  RECOGNITION_AWARDED_KIND,
  projectRecognitionAwarded,
} from "../../supabase/functions/_shared/notification-projector/projectors/recognition-awarded.ts";
import {
  findNotificationProjector,
  projectDomainEvent,
  SUPPORTED_NOTIFICATION_EVENT_TYPES,
} from "../../supabase/functions/_shared/notification-projector/registry.ts";
import type { ClaimedDomainEvent } from "../../supabase/functions/_shared/notification-projector/types.ts";

const BASE_EVENT: ClaimedDomainEvent = {
  organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  resourceRecordId: null,
  eventType: "JobFunctionAssigned",
  payload: {
    membership_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  },
  leaseToken: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  attemptCount: 1,
};

describe("notification projector registry", () => {
  it("registers the supported operational notification event types", () => {
    expect(SUPPORTED_NOTIFICATION_EVENT_TYPES).toEqual([
      "JobFunctionAssigned",
      "TrainingCompleted",
      "SkillProficiencyValidated",
      "RecognitionAwarded",
      "SuggestionReviewerAssigned",
      "SuggestionReviewerReassigned",
      "SuggestionReviewStarted",
      "SuggestionAccepted",
      "SuggestionRejected",
      "SuggestionParked",
    ]);
  });

  it("projects a supported membership payload event", () => {
    const outcome = projectJobFunctionAssigned(BASE_EVENT);

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.notificationKind).toBe(
      JOB_FUNCTION_ASSIGNED_KIND,
    );
    expect(outcome.intents[0]?.recipientMembershipId).toBe(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
  });

  it("returns null for unsupported event types", async () => {
    const outcome = await projectDomainEvent(
      {
        ...BASE_EVENT,
        eventType: "CiProjectCreated",
      },
      {
        lookupRecognitionRecipients: async () => [],
        lookupSuggestionAuthorMembershipId: async () => null,
      },
    );

    expect(outcome).toBeNull();
  });

  it("projects multiple recipients for recognition awards", async () => {
    const awardId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const outcome = await projectRecognitionAwarded(
      {
        ...BASE_EVENT,
        eventType: "RecognitionAwarded",
        resourceRecordId: awardId,
      },
      {
        lookupRecognitionRecipients: async () => [
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
        ],
      },
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(2);
    expect(
      outcome.intents.every(
        (intent) => intent.notificationKind === RECOGNITION_AWARDED_KIND,
      ),
    ).toBe(true);
    expect(
      new Set(outcome.intents.map((intent) => intent.deliveryKey)).size,
    ).toBe(2);
  });

  it("finds projectors by event type", () => {
    expect(findNotificationProjector("TrainingCompleted")?.eventType).toBe(
      "TrainingCompleted",
    );
    expect(findNotificationProjector("ActionCreated")).toBeNull();
  });
});
