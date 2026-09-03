import { describe, expect, it } from "vitest";

import { TerminalProjectionError } from "../../supabase/functions/_shared/notification-projector/errors.ts";
import { buildDeliveryKey } from "../../supabase/functions/_shared/notification-projector/delivery-key.ts";
import {
  projectSuggestionAccepted,
  projectSuggestionMoreInformationRequested,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_MORE_INFORMATION_REQUIRED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-author-notification.ts";
import {
  projectSuggestionImplemented,
  SUGGESTION_IMPLEMENTED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-implemented.ts";
import {
  projectSuggestionReviewerAssigned,
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
} from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-reviewer-assigned.ts";
import { projectSuggestionReviewStarted } from "../../supabase/functions/_shared/notification-projector/projectors/suggestion-review-started.ts";
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
      review_id: "11111111-1111-4111-8111-111111111111",
      suggestion_id: SUGGESTION_ID,
      decision: "accept",
    },
    leaseToken: "11111111-1111-4111-8111-111111111111",
    attemptCount: 1,
    ...overrides,
  };
}

function buildContext(authorMembershipId: string | null): ProjectorContext {
  return {
    lookupRecognitionRecipients: async () => [],
    lookupSuggestionAuthorMembershipId: async (
      organisationId,
      suggestionId,
    ) => {
      if (organisationId !== ORG_ID || suggestionId !== SUGGESTION_ID) {
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

    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_REVIEWER_ASSIGNED_KIND,
    );
  });

  it("no-ops SuggestionReviewStarted", () => {
    const outcome = projectSuggestionReviewStarted();

    expect(outcome).toEqual({ kind: "noop" });
  });

  it("projects SuggestionMoreInformationRequested to the author", async () => {
    const outcome = await projectSuggestionMoreInformationRequested(
      buildEvent("SuggestionMoreInformationRequested", {
        payload: { decision: "needs_more_information" },
      }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_MORE_INFORMATION_REQUIRED_KIND,
    );
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("projects SuggestionAccepted to the author via lookup", async () => {
    const outcome = await projectSuggestionAccepted(
      buildEvent("SuggestionAccepted", { payload: { decision: "accept" } }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents[0]?.notificationKind).toBe(SUGGESTION_APPROVED_KIND);
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("projects SuggestionImplemented to the author via lookup", async () => {
    const outcome = await projectSuggestionImplemented(
      buildEvent("SuggestionImplemented", { payload: {} }),
      buildContext(AUTHOR_ID),
    );

    expect(outcome.kind).toBe("project");
    if (outcome.kind !== "project") {
      throw new Error("expected project outcome");
    }

    expect(outcome.intents[0]?.notificationKind).toBe(
      SUGGESTION_IMPLEMENTED_KIND,
    );
    expect(outcome.intents[0]?.recipientMembershipId).toBe(AUTHOR_ID);
  });

  it("does not create a notification for SuggestionReviewerClaimed", async () => {
    const outcome = await projectDomainEvent(
      buildEvent("SuggestionReviewerClaimed"),
      buildContext(AUTHOR_ID),
    );

    expect(outcome).toBeNull();
    expect(findNotificationProjector("SuggestionReviewerClaimed")).toBeNull();
  });

  it("keeps delivery keys deterministic across duplicate projection", () => {
    const event = buildEvent("SuggestionReviewerAssigned");
    const first = projectSuggestionReviewerAssigned(event);
    const second = projectSuggestionReviewerAssigned(event);

    expect(first).toEqual(second);
    if (first.kind === "project" && second.kind === "project") {
      expect(first.intents[0]?.deliveryKey).toBe(
        buildDeliveryKey(
          SUGGESTION_REVIEWER_ASSIGNED_KIND,
          EVENT_ID,
          REVIEWER_ID,
        ),
      );
    }
  });

  it("fails terminally when author lookup returns null", async () => {
    await expect(
      projectSuggestionAccepted(
        buildEvent("SuggestionAccepted", { payload: { decision: "accept" } }),
        buildContext(null),
      ),
    ).rejects.toBeInstanceOf(TerminalProjectionError);
  });
});
