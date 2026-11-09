/** Keep in sync with SQL truncation for in-app notification bodies. */
export const SUGGESTION_DELEGATION_IN_APP_REASON_MAX = 400;

/** Keep in sync with SQL truncation for operational email bodies. */
export const SUGGESTION_DELEGATION_EMAIL_REASON_MAX = 500;

export function truncateDelegationReason(
  reason: string,
  maxLength: number,
): string {
  const trimmed = reason.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildDelegationInAppNotificationBodySuffix(
  reason: string | null | undefined,
): string {
  if (!reason?.trim()) {
    return "";
  }
  const limited = truncateDelegationReason(
    reason,
    SUGGESTION_DELEGATION_IN_APP_REASON_MAX,
  );
  return `\n\nReason: ${limited}`;
}
