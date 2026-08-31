import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import {
  buildSingleRecipientIntent,
  readMembershipIdFromPayload,
} from "./membership-payload.ts";

export const SKILL_PROFICIENCY_VALIDATED_EVENT = "SkillProficiencyValidated";
export const SKILL_PROFICIENCY_VALIDATED_KIND =
  "workforce.skill_proficiency_validated";

export function projectSkillProficiencyValidated(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  const recipientMembershipId = readMembershipIdFromPayload(event);

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(
        event,
        SKILL_PROFICIENCY_VALIDATED_KIND,
        recipientMembershipId,
      ),
    ],
  };
}
