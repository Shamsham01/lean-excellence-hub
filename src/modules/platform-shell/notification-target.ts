export type PlatformInAppNotificationTargetInput = {
  href: string | null;
  notification_type: string;
  dedupe_key: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function suggestionReviewHref(
  suggestionId: string,
  queue: "all" | "mine",
): string {
  return `/platform/suggestions/review?queue=${queue}&suggestionId=${suggestionId}`;
}

/** Accept only same-origin relative paths (single leading slash). */
export function normalizePlatformInAppNotificationHref(
  href: string | null | undefined,
): string | null {
  const trimmed = href?.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  const legacySchedule = "/platform/scheduling";
  if (trimmed === legacySchedule || trimmed.startsWith(`${legacySchedule}/`)) {
    return trimmed.replace(legacySchedule, "/platform/schedule");
  }

  return trimmed;
}

/**
 * Derives an in-app navigation path when the stored href column is empty or stale.
 * Matches dedupe_key shapes emitted by in_app notification SQL (issue #341+).
 */
export function resolvePlatformInAppNotificationHref(
  input: PlatformInAppNotificationTargetInput,
): string | null {
  const stored = normalizePlatformInAppNotificationHref(input.href);
  if (stored) {
    return stored;
  }

  const dedupe = input.dedupe_key.trim();
  if (!dedupe) {
    return resolveFromNotificationTypeOnly(input.notification_type);
  }

  const suggestionParts = dedupe.match(/^suggestion:([^:]+):(.+)$/i);
  if (suggestionParts) {
    const suggestionId = suggestionParts[1] ?? "";
    const suffix = suggestionParts[2] ?? "";
    if (!isUuid(suggestionId)) {
      return null;
    }

    if (suffix === "submitted") {
      return suggestionReviewHref(suggestionId, "all");
    }

    if (suffix.startsWith("approval:v")) {
      return suggestionReviewHref(suggestionId, "mine");
    }

    if (suffix.startsWith("status:")) {
      return `/platform/suggestions/${suggestionId}`;
    }

    return `/platform/suggestions/${suggestionId}`;
  }

  const overdueAction = dedupe.match(/^overdue_action:([^:]+):/i);
  if (overdueAction?.[1] && isUuid(overdueAction[1])) {
    return `/platform/actions/${overdueAction[1]}`;
  }

  const overdueSchedule = dedupe.match(/^overdue_schedule:([^:]+):/i);
  if (overdueSchedule?.[1] && isUuid(overdueSchedule[1])) {
    return "/platform/schedule";
  }

  const staleWalk = dedupe.match(/^stale_walk:([^:]+):/i);
  if (staleWalk?.[1] && isUuid(staleWalk[1])) {
    return `/platform/gemba/walks/${staleWalk[1]}`;
  }

  const staleAudit = dedupe.match(/^stale_audit:([^:]+):/i);
  if (staleAudit?.[1] && isUuid(staleAudit[1])) {
    return `/platform/5s/audits/${staleAudit[1]}`;
  }

  if (dedupe.startsWith("chase_digest:")) {
    return "/platform/actions";
  }

  return resolveFromNotificationTypeOnly(input.notification_type);
}

function resolveFromNotificationTypeOnly(
  notificationType: string,
): string | null {
  switch (notificationType) {
    case "leanai.chase_digest":
      return "/platform/actions";
    case "leanai.chase_overdue_schedule":
      return "/platform/schedule";
    default:
      return null;
  }
}
