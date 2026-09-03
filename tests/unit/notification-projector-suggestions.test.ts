import { describe, expect, it } from "vitest";

import { TerminalProjectionError } from "../../supabase/functions/_shared/notification-projector/errors.ts";
import {
  projectSuggestionAccepted,
  projectSuggestionParked,
  projectSuggestionRejected,
  projectSuggestionReviewStarted,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_DECLINED_KIND,
  SUGGESTION_PARKED_KIND,
  SUGGESTION_REVIEW_STARTED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-author-events.ts";
import {
  projectSuggestionReviewerAssigned,
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-reviewer-assigned.ts";
import {
  projectSuggestionReviewerReassigned,
  SUGGESTION_REVIEWER_REASSIGNED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-reviewer-reassigned.ts";
import type { ClaimedDomainEvent } from "../../supabase/functions/_shared/notification-projector/types.ts";

const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUGGESTION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REVIEWER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHOR_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function buildEvent(
  overrides: Partial<ClaimedDomainEvent> = {},
): ClaimedDomainEvent {
  return {
    organisationId: ORG_ID,
    eventId: EVENT_ID,
    resourceRecordId: SUGGESTION_ID,
    eventType: "SuggestionReviewerAssigned",
    payload: {
      reviewer_membership_id: REVIEWER_ID,
    },
    leaseToken: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    attemptCount: 1,
    ...overrides,
  };
}

const authorContext = {
  lookupRecognitionRecipients: async () => [],
  lookupSuggestionAuthorMembershipId: async () => AUTHOR_ID,
};

describe("suggestion notification projectors", () => {
  it("projects reviewer assigned notifications from payload", () => {
    const outcome = projectSuggestionReviewerAssigned(buildEvent());

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEWER_ASSIGNED_KIND,
    );
    expect(outcome.intents[0]?.recipientMembershipId).toBe(REVIEWER_ID);
  });

  it("projects reviewer reassigned notifications from payload", () => {
    const outcome = projectSuggestionReviewerReassigned(
      buildEvent({ eventType: "SuggestionReviewerReassigned" }),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEWER_REASSIGNED_KIND,
    );
  });

  it("rejects reviewer events without reviewer_membership_id", () => {
    expect(() =>
      projectSuggestionReviewerAssigned(buildEvent({ payload: {} })),
    ).toThrow(TerminalProjectionError);
  });

  it("rejects reviewer events without suggestion resource_record_id", () => {
    expect(() =>
      projectSuggestionReviewerAssigned(
        buildEvent({ resourceRecordId: null }),
      ),
    ).toThrow(TerminalProjectionError);
  });

  it("projects author lifecycle notifications via author lookup", async () => {
    const reviewStarted = await projectSuggestionReviewStarted(
      buildEvent({
        eventType: "SuggestionReviewStarted",
        payload: {},
      }),
      authorContext,
    );
    const accepted = await projectSuggestionAccepted(
      buildEvent({ eventType: "SuggestionAccepted", payload: {} }),
      authorContext,
    );
    const rejected = await projectSuggestionRejected(
      buildEvent({ eventType: "SuggestionRejected", payload: {} }),
      authorContext,
    );
    const parked = await projectSuggestionParked(
      buildEvent({ eventType: "SuggestionParked", payload: {} }),
      authorContext,
    );

    expect(reviewStarted.kind).toBe("project");
    expect(accepted.kind).toBe("project");
    expect(rejected.kind).toBe("project");
    expect(parked.kind).toBe("project");

    if (
      reviewStarted.kind !== "project" ||
      accepted.kind !== "project" ||
      rejected.kind !== "project" ||
      parked.kind !== "project"
    ) {
      throw new Error("expected project outcomes");
    }

    expect(reviewStarted.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEW_STARTED_KIND,
    );
    expect(accepted.intents[0]?.notificationKind).toBe(SUGGESTION_APPROVED_KIND);
    expect(rejected.intents[0]?.notificationKind).toBe(
      SUGGESTION_DECLINED_KIND,
    );
    expect(parked.intents[0]?.notificationKind).toBe(SUGGESTION_PARKED_KIND);
    expect(reviewStarted.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("fails author events when suggestion author cannot be resolved", async () => {
    await expect(
      projectSuggestionReviewStarted(
        buildEvent({ eventType: "SuggestionReviewStarted", payload: {} }),
        {
          lookupRecognitionRecipients: async () => [],
          lookupSuggestionAuthorMembershipId: async () => null,
        },
      ),
    ).rejects.toThrow(TerminalProjectionError);
  });

  it("uses stable delivery keys across duplicate projection", () => {
    const first = projectSuggestionReviewerAssigned(buildEvent());
    const second = projectSuggestionReviewerAssigned(buildEvent());

    expect(first).toEqual(second);
  });
});
