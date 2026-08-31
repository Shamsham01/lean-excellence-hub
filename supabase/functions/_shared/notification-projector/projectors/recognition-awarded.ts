import { buildDeliveryKey } from "../delivery-key.ts";
import { TerminalProjectionError } from "../errors.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
  ProjectorOutcome,
} from "../types.ts";

export const RECOGNITION_AWARDED_EVENT = "RecognitionAwarded";
export const RECOGNITION_AWARDED_KIND = "recognition.awarded";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function projectRecognitionAwarded(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome> {
  if (
    !event.resourceRecordId ||
    !UUID_PATTERN.test(event.resourceRecordId)
  ) {
    throw new TerminalProjectionError(
      "invalid_payload",
      "RecognitionAwarded requires resource_record_id award UUID",
    );
  }

  const recipientMembershipIds = await context.lookupRecognitionRecipients(
    event.organisationId,
    event.resourceRecordId,
  );

  if (recipientMembershipIds.length === 0) {
    throw new TerminalProjectionError(
      "missing_reference",
      "RecognitionAwarded has no recipients",
    );
  }

  return {
    kind: "project",
    intents: recipientMembershipIds.map((recipientMembershipId) => ({
      recipientMembershipId,
      notificationKind: RECOGNITION_AWARDED_KIND,
      deliveryKey: buildDeliveryKey(
        RECOGNITION_AWARDED_KIND,
        event.eventId,
        recipientMembershipId,
      ),
    })),
  };
}
