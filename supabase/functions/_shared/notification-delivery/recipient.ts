import type { RecipientResolutionStatus } from "./types.ts";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isDeliverableEmailAddress(candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 320) {
    return false;
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return false;
  }

  if (
    normalized.endsWith("@workforce.invalid") ||
    normalized.endsWith(".invalid")
  ) {
    return false;
  }

  return true;
}

export function mapRecipientFailureCode(
  status: RecipientResolutionStatus,
): string {
  switch (status) {
    case "inactive_membership":
      return "inactive_membership";
    case "disabled_workforce_account":
      return "disabled_workforce_account";
    case "synthetic_auth_email":
      return "synthetic_auth_email";
    case "invalid_email":
      return "invalid_recipient_email";
    case "not_authorized":
      return "recipient_no_longer_authorized";
    case "no_contact":
    default:
      return "missing_recipient_contact";
  }
}
