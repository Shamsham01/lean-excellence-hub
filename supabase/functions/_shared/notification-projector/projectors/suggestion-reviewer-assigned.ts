import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";
import {
  readReviewerMembershipIdFromPayload,
  requireSuggestionResourceRecordId,
} from "./suggestion-payload.ts";

export const SUGGESTION_REVIEWER_ASSIGNED_EVENT =
  "SuggestionReviewerAssigned";
export const SUGGESTION_REVIEWER_ASSIGNED_KIND =
  "suggestions.reviewer_assigned";

export function projectSuggestionReviewerAssigned(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  requireSuggestionResourceRecordId(event);
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
