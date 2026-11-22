import { buildDeliveryKey } from "../delivery-key.ts";
import { TerminalProjectionError } from "../errors.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
  ProjectorOutcome,
} from "../types.ts";
import { readSuggestionIdFromEvent } from "./suggestion-payload.ts";

export const SUGGESTION_SUBMITTED_EVENT = "SuggestionSubmitted";
export const SUGGESTION_AWAITING_REVIEW_KIND = "suggestions.awaiting_review";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function projectSuggestionSubmitted(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  const suggestionId = readSuggestionIdFromEvent(event);
  if (!UUID_PATTERN.test(suggestionId)) {
    throw new TerminalProjectionError(
      "invalid_payload",
      "SuggestionSubmitted requires suggestion UUID resource record",
    );
  }

  const recipientMembershipIds =
    await context.lookupSuggestionApprovalRecipients(
      event.organisationId,
      suggestionId,
    );

  if (recipientMembershipIds.length === 0) {
    return { kind: "noop" };
  }

  return {
    kind: "project",
    intents: recipientMembershipIds.map((recipientMembershipId) => ({
      recipientMembershipId,
      notificationKind: SUGGESTION_AWAITING_REVIEW_KIND,
      deliveryKey: buildDeliveryKey(
        SUGGESTION_AWAITING_REVIEW_KIND,
        event.eventId,
        recipientMembershipId,
      ),
    })),
  };
}
