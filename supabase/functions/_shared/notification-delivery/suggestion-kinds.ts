export const SUGGESTIONS_REVIEWER_NOTIFICATION_KINDS = [
  "suggestions.reviewer_assigned",
  "suggestions.reviewer_reassigned",
] as const;

export const SUGGESTIONS_AUTHOR_NOTIFICATION_KINDS = [
  "suggestions.review_started",
  "suggestions.approved",
  "suggestions.declined",
  "suggestions.parked",
] as const;

export const SUGGESTIONS_NOTIFICATION_KINDS = [
  ...SUGGESTIONS_REVIEWER_NOTIFICATION_KINDS,
  ...SUGGESTIONS_AUTHOR_NOTIFICATION_KINDS,
] as const;

export type SuggestionsNotificationKind =
  (typeof SUGGESTIONS_NOTIFICATION_KINDS)[number];

export function isSuggestionsNotificationKind(
  notificationKind: string,
): notificationKind is SuggestionsNotificationKind {
  return (SUGGESTIONS_NOTIFICATION_KINDS as readonly string[]).includes(
    notificationKind,
  );
}
