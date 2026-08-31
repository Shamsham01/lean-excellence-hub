import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import {
  buildSingleRecipientIntent,
  readMembershipIdFromPayload,
} from "./membership-payload.ts";

export const TRAINING_COMPLETED_EVENT = "TrainingCompleted";
export const TRAINING_COMPLETED_KIND = "workforce.training_completed";

export function projectTrainingCompleted(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  const recipientMembershipId = readMembershipIdFromPayload(event);

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(
        event,
        TRAINING_COMPLETED_KIND,
        recipientMembershipId,
      ),
    ],
  };
}
