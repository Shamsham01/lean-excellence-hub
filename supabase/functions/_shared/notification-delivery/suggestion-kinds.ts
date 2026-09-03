export const SUGGESTION_REVIEWER_ASSIGNED_KIND =
  "suggestions.reviewer_assigned";
export const SUGGESTION_REVIEWER_REASSIGNED_KIND =
  "suggestions.reviewer_reassigned";
export const SUGGESTION_MORE_INFORMATION_REQUIRED_KIND =
  "suggestions.more_information_required";
export const SUGGESTION_APPROVED_KIND = "suggestions.approved";
export const SUGGESTION_DECLINED_KIND = "suggestions.declined";
export const SUGGESTION_PARKED_KIND = "suggestions.parked";
export const SUGGESTION_IMPLEMENTED_KIND = "suggestions.implemented";

export const SUGGESTION_NOTIFICATION_KINDS = new Set([
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
  SUGGESTION_REVIEWER_REASSIGNED_KIND,
  SUGGESTION_MORE_INFORMATION_REQUIRED_KIND,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_DECLINED_KIND,
  SUGGESTION_PARKED_KIND,
  SUGGESTION_IMPLEMENTED_KIND,
]);

export function requiresDeliveryTimeAuthorizationRevalidation(
  notificationKind: string,
): boolean {
  return SUGGESTION_NOTIFICATION_KINDS.has(notificationKind);
}
