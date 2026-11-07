/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlatformOwnerNotificationBell } from "@/components/platform-admin/notification-bell";

vi.mock("@/app/org_admin/(console)/actions", () => ({
  markPlatformOwnerInAppNotificationRead: vi.fn(async () => ({ ok: true })),
  markAllPlatformOwnerInAppNotificationsRead: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("PlatformOwnerNotificationBell", () => {
  it("renders unread signup and billing alert badge", () => {
    render(
      <PlatformOwnerNotificationBell
        initialUnreadCount={2}
        initialItems={[
          {
            id: "n1",
            title: "Organisation founded",
            body: "Acme is provisioning.",
            href: "/org_admin/organisations/abc",
            read_at: null,
            created_at: new Date().toISOString(),
            notification_type: "platform_operator",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Alerts, 2 unread/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-owner-notification-count")).toHaveTextContent(
      "2",
    );
  });
});
