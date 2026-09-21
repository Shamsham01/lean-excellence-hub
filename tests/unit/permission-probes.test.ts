/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
  },
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/settings/people",
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

import {
  currentMemberCanDelegateRoles,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("permission probes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns false for legitimate permission denial", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      currentMemberHasPermission("invitations.manage"),
    ).resolves.toBe(false);
  });

  it("throws a platform boundary error for infrastructure RPC failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "canceling statement" },
    });

    await expect(
      currentMemberHasPermission("roles.delegate"),
    ).rejects.toBeInstanceOf(PlatformBoundaryError);
  });

  it("gates delegation authority on roles.delegate rather than offer count", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(currentMemberCanDelegateRoles()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("member_has_permission", {
      target_permission_key: "roles.delegate",
    });
  });

  it("returns empty offers for permission denial without treating it as infra", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "delegation offers are not authorised" },
    });

    await expect(loadDelegatableAccessOffers()).resolves.toEqual({
      offers: [],
    });
  });

  it("throws for delegatable offer loader infrastructure failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    await expect(loadDelegatableAccessOffers()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });
});
