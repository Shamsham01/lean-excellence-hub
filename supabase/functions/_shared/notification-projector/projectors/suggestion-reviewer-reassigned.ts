import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import {
  readReviewerMembershipIdFromPayload,
  readSuggestionIdFromEvent,
} from "./suggestion-payload.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";

export const SUGGESTION_REVIEWER_REASSIGNED_EVENT =
  "SuggestionReviewerReassigned";
export const SUGGESTION_REVIEWER_REASSIGNED_KIND =
  "suggestions.reviewer_reassigned";

export function projectSuggestionReviewerReassigned(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  readSuggestionIdFromEvent(event);
  const recipientMembershipId = readReviewerMembershipIdFromPayload(event);

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(
        event,
        SUGGESTION_REVIEWER_REASSIGNED_KIND,
        recipientMembershipId,
      ),
    ],
  };
}
