import { TerminalProjectionError } from "../errors.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";
import { readSuggestionIdFromEvent } from "./suggestion-payload.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
  ProjectorOutcome,
} from "../types.ts";

export const SUGGESTION_REVIEW_STARTED_EVENT = "SuggestionReviewStarted";
export const SUGGESTION_REVIEW_STARTED_KIND = "suggestions.review_started";

export const SUGGESTION_ACCEPTED_EVENT = "SuggestionAccepted";
export const SUGGESTION_APPROVED_KIND = "suggestions.approved";

export const SUGGESTION_REJECTED_EVENT = "SuggestionRejected";
export const SUGGESTION_DECLINED_KIND = "suggestions.declined";

export const SUGGESTION_PARKED_EVENT = "SuggestionParked";
export const SUGGESTION_PARKED_KIND = "suggestions.parked";

async function projectSuggestionAuthorNotification(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
  notificationKind: string,
): Promise<ProjectorOutcome> {
  const suggestionId = readSuggestionIdFromEvent(event);
  const authorMembershipId =
    await context.lookupSuggestionAuthorMembershipId(
      event.organisationId,
      suggestionId,
    );

  if (!authorMembershipId) {
    throw new TerminalProjectionError(
      "missing_reference",
      `${event.eventType} author membership could not be resolved`,
    );
  }

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(event, notificationKind, authorMembershipId),
    ],
  };
}

export function projectSuggestionReviewStarted(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  return projectSuggestionAuthorNotification(
    event,
    context,
    SUGGESTION_REVIEW_STARTED_KIND,
  );
}

export function projectSuggestionAccepted(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  return projectSuggestionAuthorNotification(
    event,
    context,
    SUGGESTION_APPROVED_KIND,
  );
}

export function projectSuggestionRejected(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  return projectSuggestionAuthorNotification(
    event,
    context,
    SUGGESTION_DECLINED_KIND,
  );
}

export function projectSuggestionParked(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  return projectSuggestionAuthorNotification(
    event,
    context,
    SUGGESTION_PARKED_KIND,
  );
}
