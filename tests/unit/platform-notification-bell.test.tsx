/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpenInAppNotificationResult } from "@/app/(platform)/platform/notifications/actions";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";

const { openInAppNotification } = vi.hoisted(() => ({
  openInAppNotification: vi.fn(
    async (
      _notificationId: string,
    ): Promise<
      { ok: true; href: string } | { ok: false; message: string }
    > => ({
      ok: true,
      href: "/platform/actions/abc",
    }),
  ),
}));

vi.mock("@/app/(platform)/platform/notifications/actions", () => ({
  markAllInAppNotificationsRead: vi.fn(async () => ({ ok: true as const })),
  openInAppNotification,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("PlatformNotificationBell", () => {
  afterEach(() => {
    cleanup();
    openInAppNotification.mockClear();
  });

  it("renders a labelled control with unread badge", () => {
    render(
      <PlatformNotificationBell
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
            dedupe_key: "test:1",
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
      <PlatformNotificationBell initialUnreadCount={0} initialItems={[]} />,
    );

    expect(
      screen.getByRole("button", { name: /^notifications$/i }),
    ).toBeInTheDocument();
  });

  it("surfaces access failures in the ephemeral toast without closing the menu", async () => {
    openInAppNotification.mockResolvedValueOnce({
      ok: false,
      message:
        "This item is no longer available or you do not have access to it.",
    } satisfies OpenInAppNotificationResult);

    render(
      <PlatformNotificationBell
        initialUnreadCount={1}
        initialItems={[
          {
            id: "n1",
            title: "Test",
            body: "Details",
            href: "/platform/actions/abc",
            read_at: null,
            created_at: new Date().toISOString(),
            notification_type: "test",
            dedupe_key: "test:1",
          },
        ]}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("platform-notification-bell"));
    fireEvent.click(screen.getByTestId("platform-notification-item-n1"));

    await waitFor(() => {
      expect(screen.getByTestId("platform-ephemeral-toast")).toHaveTextContent(
        /no longer available/i,
      );
    });
  });

  it("opens the notification target via the server action on row click", async () => {
    render(
      <PlatformNotificationBell
        initialUnreadCount={1}
        initialItems={[
          {
            id: "n1",
            title: "Test",
            body: "Details",
            href: "/platform/actions/abc",
            read_at: null,
            created_at: new Date().toISOString(),
            notification_type: "test",
            dedupe_key: "test:1",
          },
        ]}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("platform-notification-bell"));
    fireEvent.click(screen.getByTestId("platform-notification-item-n1"));

    await waitFor(() => {
      expect(openInAppNotification).toHaveBeenCalledWith("n1");
    });
  });
});
