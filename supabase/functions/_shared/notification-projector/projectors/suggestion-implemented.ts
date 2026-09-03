import { TerminalProjectionError } from "../errors.ts";
import { buildSingleRecipientIntent } from "./membership-payload.ts";
import { readSuggestionIdFromEvent } from "./suggestion-payload.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
  ProjectorOutcome,
} from "../types.ts";

export const SUGGESTION_IMPLEMENTED_EVENT = "SuggestionImplemented";
export const SUGGESTION_IMPLEMENTED_KIND = "suggestions.implemented";

export async function projectSuggestionImplemented(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  const suggestionId = readSuggestionIdFromEvent(event);
  const authorMembershipId = await context.lookupSuggestionAuthorMembershipId(
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
      buildSingleRecipientIntent(
        event,
        SUGGESTION_IMPLEMENTED_KIND,
        authorMembershipId,
      ),
    ],
  };
}
