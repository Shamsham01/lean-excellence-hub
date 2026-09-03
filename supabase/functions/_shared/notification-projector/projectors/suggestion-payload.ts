import { TerminalProjectionError } from "../errors.ts";
import type { ClaimedDomainEvent } from "../types.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readSuggestionIdFromEvent(
  event: ClaimedDomainEvent,
): string {
  if (!event.resourceRecordId || !UUID_PATTERN.test(event.resourceRecordId)) {
    throw new TerminalProjectionError(
      "invalid_payload",
      `${event.eventType} requires resource_record_id suggestion UUID`,
    );
  }

  return event.resourceRecordId;
}

export function readReviewerMembershipIdFromPayload(
  event: ClaimedDomainEvent,
): string {
  const rawValue = event.payload.reviewer_membership_id;

  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new TerminalProjectionError(
      "invalid_payload",
      `${event.eventType} payload must include reviewer_membership_id`,
    );
  }

  const membershipId = rawValue.trim();
  if (!UUID_PATTERN.test(membershipId)) {
    throw new TerminalProjectionError(
      "invalid_payload",
      `${event.eventType} payload reviewer_membership_id must be a UUID`,
    );
  }

  return membershipId;
}
