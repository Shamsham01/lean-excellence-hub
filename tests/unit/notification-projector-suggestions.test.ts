import { describe, expect, it, vi } from "vitest";

import { TerminalProjectionError } from "../../supabase/functions/_shared/notification-projector/errors.ts";
import { buildDeliveryKey } from "../../supabase/functions/_shared/notification-projector/delivery-key.ts";
import {
  projectSuggestionAccepted,
  projectSuggestionParked,
  projectSuggestionRejected,
  projectSuggestionReviewStarted,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_DECLINED_KIND,
  SUGGESTION_PARKED_KIND,
  SUGGESTION_REVIEW_STARTED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-author-notification.ts";
import {
  projectSuggestionReviewerAssigned,
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-reviewer-assigned.ts";
import {
  projectSuggestionReviewerReassigned,
  SUGGESTION_REVIEWER_REASSIGNED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-reviewer-reassigned.ts";
import {
  findNotificationProjector,
  projectDomainEvent,
} from "../../supabase/functions/_shared/notification-projector/registry.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
} from "../../supabase/functions/_shared/notification-projector/types.ts";

const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUGGESTION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REVIEWER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const AUTHOR_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OTHER_ORG_SUGGESTION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function buildEvent(
  eventType: string,
  overrides: Partial<ClaimedDomainEvent> = {},
): ClaimedDomainEvent {
  return {
    organisationId: ORG_ID,
    eventId: EVENT_ID,
    resourceRecordId: SUGGESTION_ID,
    eventType,
    payload: {
      reviewer_membership_id: REVIEWER_ID,
    },
    leaseToken: "11111111-1111-4111-8111-111111111111",
    attemptCount: 1,
    ...overrides,
  };
}

function buildContext(
  authorMembershipId: string | null,
): ProjectorContext {
  return {
    lookupRecognitionRecipients: async () => [],
    lookupSuggestionAuthorMembershipId: async (organisationId, suggestionId) => {
      if (
        organisationId !== ORG_ID ||
        suggestionId !== SUGGESTION_ID
      ) {
        return null;
      }

      return authorMembershipId;
    },
  };
}

describe("suggestion notification projectors", () => {
  it("projects SuggestionReviewerAssigned to the reviewer membership", () => {
    const outcome = projectSuggestionReviewerAssigned(
      buildEvent("SuggestionReviewerAssigned"),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]).toEqual({
      recipientMembershipId: REVIEWER_ID,
      notificationKind: SUGGESTION_REVIEWER_ASSIGNED_KIND,
      deliveryKey: buildDeliveryKey(
        SUGGESTION_REVIEWER_ASSIGNED_KIND,
        EVENT_ID,
        REVIEWER_ID,
      ),
    });
  });

  it("projects SuggestionReviewerReassigned to the new reviewer only", () => {
    const outcome = projectSuggestionReviewerReassigned(
      buildEvent("SuggestionReviewerReassigned"),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents).toHaveLength(1);
    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEWER_REASSIGNED_KIND,
    );
    expect(outcome.intents[0]?.recipientMembershipId).toBe(REVIEWER_ID);
  });

  it("classifies malformed assignment payload as terminal invalid_payload", () => {
    expect(() =>
      projectSuggestionReviewerAssigned(
        buildEvent("SuggestionReviewerAssigned", { payload: {} }),
      ),
    ).toThrow(TerminalProjectionError);

    try {
      projectSuggestionReviewerAssigned(
        buildEvent("SuggestionReviewerAssigned", { payload: {} }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(TerminalProjectionError);
      expect((error as TerminalProjectionError).code).toBe("invalid_payload");
    }
  });

  it("projects SuggestionReviewStarted to the author via lookup", async () => {
    const outcome = await projectSuggestionReviewStarted(
      buildEvent("SuggestionReviewStarted", { payload: {} }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEW_STARTED_KIND,
    );
  });

  it("projects SuggestionAccepted to the author via lookup", async () => {
    const outcome = await projectSuggestionAccepted(
      buildEvent("SuggestionAccepted", { payload: { decision: "accept" } }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.intents[0]?.notificationKind).toBe(SUGGESTION_APPROVED_KIND);
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("projects SuggestionRejected to the author via lookup", async () => {
    const outcome = await projectSuggestionRejected(
      buildEvent("SuggestionRejected", { payload: { decision: "reject" } }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.intents[0]?.notificationKind).toBe(SUGGESTION_DECLINED_KIND);
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("projects SuggestionParked to the author via lookup", async () => {
    const outcome = await projectSuggestionParked(
      buildEvent("SuggestionParked", { payload: { decision: "park" } }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.intents[0]?.notificationKind).toBe(SUGGESTION_PARKED_KIND);
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("prevents cross-organisation author lookup", async () => {
    const context: ProjectorContext = {
      lookupRecognitionRecipients: async () => [],
      lookupSuggestionAuthorMembershipId: async (organisationId) =>
        organisationId === ORG_ID ? AUTHOR_ID : null,
    };

    await expect(
      projectSuggestionReviewStarted(
        buildEvent("SuggestionReviewStarted", {
          organisationId: "99999999-9999-4999-8999-999999999999",
          resourceRecordId: OTHER_ORG_SUGGESTION_ID,
          payload: {},
        }),
        context,
      ),
    ).rejects.toMatchObject({ code: "missing_reference" });
  });

  it("fails terminally when author lookup returns null", async () => {
    await expect(
      projectSuggestionReviewStarted(
        buildEvent("SuggestionReviewStarted", { payload: {} }),
        buildContext(null),
      ),
    ).rejects.toMatchObject({ code: "missing_reference" });
  });

  it("does not create a notification for SuggestionReviewerClaimed", async () => {
    const outcome = await projectDomainEvent(
      buildEvent("SuggestionReviewerClaimed"),
      buildContext(AUTHOR_ID),
    );

    expect(outcome).toBeNull();
    expect(findNotificationProjector("SuggestionReviewerClaimed")).toBeNull();
  });

  it("keeps unrelated events unsupported", async () => {
    const outcome = await projectDomainEvent(
      buildEvent("SuggestionSubmitted", { payload: {} }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome).toBeNull();
  });

  it("keeps delivery keys deterministic across duplicate projection", () => {
    const event = buildEvent("SuggestionReviewerAssigned");
    const first = projectSuggestionReviewerAssigned(event);
    const second = projectSuggestionReviewerAssigned(event);

    expect(first).toEqual(second);
  });
});
