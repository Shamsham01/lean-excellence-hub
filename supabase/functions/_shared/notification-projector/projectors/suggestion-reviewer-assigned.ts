import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import {
  readReviewerMembershipIdFromPayload,
  readSuggestionIdFromEvent,
} from "./suggestion-payload.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";

export const SUGGESTION_REVIEWER_ASSIGNED_EVENT = "SuggestionReviewerAssigned";
export const SUGGESTION_REVIEWER_ASSIGNED_KIND =
  "suggestions.reviewer_assigned";

export function projectSuggestionReviewerAssigned(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  readSuggestionIdFromEvent(event);
  const recipientMembershipId = readReviewerMembershipIdFromPayload(event);

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(
        event,
        SUGGESTION_REVIEWER_ASSIGNED_KIND,
        recipientMembershipId,
      ),
    ],
  };
}
