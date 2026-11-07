import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc,
    from,
  })),
}));

import { loadPlatformNotificationSnapshot } from "@/modules/platform-shell/notifications";

describe("loadPlatformNotificationSnapshot", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    rpc.mockResolvedValue({ data: 1, error: null });
    from.mockImplementation((table: string) => {
      if (table !== "in_app_notifications") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: vi.fn((_cols: string, opts?: { head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({ count: 0, error: null }),
            };
          }
          return {
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      };
    });
  });

  it("syncs operational chase notifications before listing rows", async () => {
    await loadPlatformNotificationSnapshot("membership-1");

    expect(rpc).toHaveBeenCalledWith(
      "sync_leanai_operational_chase_notifications",
    );
  });

  it("falls back to legacy overdue sync when unified RPC is unavailable", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "function not found" },
      })
      .mockResolvedValueOnce({ data: 0, error: null });

    await loadPlatformNotificationSnapshot("membership-1");

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "sync_leanai_operational_chase_notifications",
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "sync_overdue_action_chase_notifications",
    );
  });
});
