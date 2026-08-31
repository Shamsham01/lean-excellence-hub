import { buildDeliveryKey } from "../delivery-key.ts";
import { TerminalProjectionError } from "../errors.ts";
import type { ClaimedDomainEvent, ProjectionIntent } from "../types.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readMembershipIdFromPayload(
  event: ClaimedDomainEvent,
  fieldName = "membership_id",
): string {
  const rawValue = event.payload[fieldName];

  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new TerminalProjectionError(
      "invalid_payload",
      `${event.eventType} payload must include ${fieldName}`,
    );
  }

  const membershipId = rawValue.trim();
  if (!UUID_PATTERN.test(membershipId)) {
    throw new TerminalProjectionError(
      "invalid_payload",
      `${event.eventType} payload ${fieldName} must be a UUID`,
    );
  }

  return membershipId;
}

export function buildSingleRecipientIntent(
  event: ClaimedDomainEvent,
  notificationKind: string,
  recipientMembershipId: string,
): ProjectionIntent {
  return {
    recipientMembershipId,
    notificationKind,
    deliveryKey: buildDeliveryKey(
      notificationKind,
      event.eventId,
      recipientMembershipId,
    ),
  };
}
