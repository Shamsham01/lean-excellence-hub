/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const readRequestPathname = vi.fn(async () => "/platform/people");

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: () => readRequestPathname(),
}));

import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("platform permission checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns false for legitimate permission denial codes", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });

    await expect(
      currentMemberHasPermission("people.capability.read"),
    ).resolves.toBe(false);
  });

  it("throws a platform boundary error for transport failures", async () => {
    rpc.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(currentMemberHasPermission("gemba.read")).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });

  it("throws a platform boundary error for infrastructure RPC failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "canceling statement" },
    });

    await expect(currentMemberHasPermission("gemba.read")).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });

  it("does not swallow Next.js dynamic-rendering control errors", async () => {
    const dynamicError = Object.assign(
      new Error("Dynamic server usage: Route /platform used cookies"),
      { digest: "DYNAMIC_SERVER_USAGE" },
    );
    rpc.mockRejectedValueOnce(dynamicError);

    await expect(currentMemberHasPermission("gemba.read")).rejects.toBe(
      dynamicError,
    );
  });

  it("returns true only when the RPC explicitly grants the permission", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(currentMemberHasPermission("gemba.read")).resolves.toBe(true);
  });
});
