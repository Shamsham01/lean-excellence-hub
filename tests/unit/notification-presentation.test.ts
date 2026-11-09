import { describe, expect, it } from "vitest";

import {
  collapseChaseDigestNotifications,
  collapseChaseDigestUnreadCount,
} from "@/modules/platform-shell/notification-presentation";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";

function row(
  partial: Partial<PlatformInAppNotification> & Pick<PlatformInAppNotification, "id" | "notification_type">,
): PlatformInAppNotification {
  return {
    title: "t",
    body: null,
    href: null,
    read_at: null,
    created_at: "2026-11-09T12:00:00.000Z",
    ...partial,
  };
}

describe("collapseChaseDigestNotifications", () => {
  it("hides unread leanai chase rows when an unread digest is present", () => {
    const items = [
      row({ id: "1", notification_type: "leanai.chase_overdue_action" }),
      row({ id: "2", notification_type: "leanai.chase_digest" }),
      row({ id: "3", notification_type: "suggestion.status_accepted" }),
    ];

    expect(collapseChaseDigestNotifications(items).map((item) => item.id)).toEqual([
      "2",
      "3",
    ]);
  });

  it("keeps chase rows when digest is read", () => {
    const items = [
      row({ id: "1", notification_type: "leanai.chase_overdue_action" }),
      row({
        id: "2",
        notification_type: "leanai.chase_digest",
        read_at: "2026-11-09T12:01:00.000Z",
      }),
    ];

    expect(collapseChaseDigestNotifications(items)).toHaveLength(2);
  });
});

describe("collapseChaseDigestUnreadCount", () => {
  it("subtracts hidden unread chases from the badge count", () => {
    const items = [
      row({ id: "1", notification_type: "leanai.chase_overdue_action" }),
      row({ id: "2", notification_type: "leanai.chase_overdue_schedule" }),
      row({ id: "3", notification_type: "leanai.chase_digest" }),
    ];

    expect(collapseChaseDigestUnreadCount(items, 3)).toBe(1);
  });
});
