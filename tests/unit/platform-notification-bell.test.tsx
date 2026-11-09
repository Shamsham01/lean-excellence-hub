/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";

vi.mock("@/app/(platform)/platform/notifications/actions", () => ({
  markInAppNotificationRead: vi.fn(async () => ({ ok: true as const })),
  markAllInAppNotificationsRead: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("PlatformNotificationBell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a labelled control with unread badge", () => {
    render(
      <PlatformNotificationBell
        variant="header"
        initialUnreadCount={3}
        initialItems={[
          {
            id: "n1",
            title: "Test",
            body: "Details",
            href: "/platform/actions/abc",
            read_at: null,
            created_at: new Date().toISOString(),
            notification_type: "test",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Notifications, 3 unread/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-notification-count")).toHaveTextContent(
      "3",
    );
  });

  it("labels the control when there is nothing unread", () => {
    render(
      <PlatformNotificationBell
        variant="header"
        initialUnreadCount={0}
        initialItems={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^notifications$/i }),
    ).toBeInTheDocument();
  });
});
