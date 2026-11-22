import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";

const CHASE_TYPE_PREFIX = "leanai.chase_";
const CHASE_DIGEST_TYPE = "leanai.chase_digest";

export function collapseChaseDigestNotifications(
  items: PlatformInAppNotification[],
): PlatformInAppNotification[] {
  const hasUnreadDigest = items.some(
    (item) =>
      item.notification_type === CHASE_DIGEST_TYPE && item.read_at == null,
  );

  if (!hasUnreadDigest) {
    return items;
  }

  return items.filter(
    (item) =>
      item.notification_type === CHASE_DIGEST_TYPE ||
      !item.notification_type.startsWith(CHASE_TYPE_PREFIX) ||
      item.read_at != null,
  );
}

export function collapseChaseDigestUnreadCount(
  items: PlatformInAppNotification[],
  unreadCount: number,
): number {
  const hasUnreadDigest = items.some(
    (item) =>
      item.notification_type === CHASE_DIGEST_TYPE && item.read_at == null,
  );

  if (!hasUnreadDigest) {
    return unreadCount;
  }

  const hiddenUnreadChases = items.filter(
    (item) =>
      item.notification_type.startsWith(CHASE_TYPE_PREFIX) &&
      item.notification_type !== CHASE_DIGEST_TYPE &&
      item.read_at == null,
  ).length;

  return Math.max(unreadCount - hiddenUnreadChases, 0);
}
