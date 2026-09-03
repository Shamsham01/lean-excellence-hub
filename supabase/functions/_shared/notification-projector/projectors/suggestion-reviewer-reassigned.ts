import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";
import {
  readReviewerMembershipIdFromPayload,
  requireSuggestionResourceRecordId,
} from "./suggestion-payload.ts";

export const SUGGESTION_REVIEWER_REASSIGNED_EVENT =
  "SuggestionReviewerReassigned";
export const SUGGESTION_REVIEWER_REASSIGNED_KIND =
  "suggestions.reviewer_reassigned";

export function projectSuggestionReviewerReassigned(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  requireSuggestionResourceRecordId(event);
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
