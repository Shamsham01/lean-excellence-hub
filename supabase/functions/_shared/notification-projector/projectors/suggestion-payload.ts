import { TerminalProjectionError } from "../errors.ts";
import type { ClaimedDomainEvent } from "../types.ts";
import { readMembershipIdFromPayload } from "./membership-payload.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readReviewerMembershipIdFromPayload(
  event: ClaimedDomainEvent,
): string {
  return readMembershipIdFromPayload(event, "reviewer_membership_id");
}

export function requireSuggestionResourceRecordId(
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
