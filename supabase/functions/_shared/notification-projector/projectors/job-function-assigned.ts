import type { ClaimedDomainEvent, ProjectorOutcome } from "../types.ts";
import {
  buildSingleRecipientIntent,
  readMembershipIdFromPayload,
} from "./membership-payload.ts";

export const JOB_FUNCTION_ASSIGNED_EVENT = "JobFunctionAssigned";
export const JOB_FUNCTION_ASSIGNED_KIND = "workforce.job_function_assigned";

export function projectJobFunctionAssigned(
  event: ClaimedDomainEvent,
): ProjectorOutcome {
  const recipientMembershipId = readMembershipIdFromPayload(event);

  return {
    kind: "project",
    intents: [
      buildSingleRecipientIntent(
        event,
        JOB_FUNCTION_ASSIGNED_KIND,
        recipientMembershipId,
      ),
    ],
  };
}
