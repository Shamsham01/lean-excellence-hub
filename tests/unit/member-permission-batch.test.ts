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
  readRequestPathname: async () => "/platform",
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

import { resetPermissionResolutionStoreForTests } from "@/modules/platform-shell/permission-resolution-store";
import {
  currentMemberHasPermission,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";
import { collectPlatformShellPermissionKeys } from "@/modules/platform-shell/shell-permission-keys";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("member permission batch resolution", () => {
  beforeEach(() => {
    resetPermissionResolutionStoreForTests();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("prefetches shell keys with one batch RPC and serves cached lookups", async () => {
    const shellKeys = collectPlatformShellPermissionKeys();
    rpc.mockResolvedValueOnce({
      data: Object.fromEntries(shellKeys.map((key) => [key, true])),
      error: null,
    });

    await prefetchMemberPermissions(shellKeys);

    await expect(currentMemberHasPermission("actions.read")).resolves.toBe(
      true,
    );
    await expect(currentMemberHasPermission("suggestions.read")).resolves.toBe(
      true,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("member_has_permissions", {
      target_permission_keys: shellKeys,
    });
  });

  it("keeps denied permissions fail-closed after batch prefetch", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        "suggestions.read": true,
        "suggestions.manage": false,
      },
      error: null,
    });

    await prefetchMemberPermissions(["suggestions.read", "suggestions.manage"]);

    await expect(currentMemberHasPermission("suggestions.read")).resolves.toBe(
      true,
    );
    await expect(
      currentMemberHasPermission("suggestions.manage"),
    ).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("uses the single-key RPC when only one uncached permission is requested", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      currentMemberHasPermission("invitations.manage"),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("member_has_permission", {
      target_permission_key: "invitations.manage",
    });
  });

  it("returns granted single-key probes when the store is not request-shared (server action path)", async () => {
    vi.doUnmock("@/modules/platform-shell/permission-resolution-store");
    vi.resetModules();

    const getPermissionResolutionStore = vi
      .fn()
      .mockImplementation(async () => new Map<string, boolean>());

    vi.doMock("@/modules/platform-shell/permission-resolution-store", () => ({
      getPermissionResolutionStore,
    }));

    const { currentMemberHasPermission: probePermission } =
      await import("@/modules/platform-shell/permissions");

    rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(probePermission("workforce.provision")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("member_has_permission", {
      target_permission_key: "workforce.provision",
    });
    expect(getPermissionResolutionStore).toHaveBeenCalledTimes(1);

    vi.doUnmock("@/modules/platform-shell/permission-resolution-store");
    vi.resetModules();
  });

  it("throws a platform boundary error when a batch entry is null", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        "suggestions.read": null,
        "suggestions.manage": false,
      },
      error: null,
    });

    await expect(
      prefetchMemberPermissions(["suggestions.read", "suggestions.manage"]),
    ).rejects.toBeInstanceOf(PlatformBoundaryError);
  });

  it("throws a platform boundary error when a requested batch key is missing", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        "suggestions.read": true,
      },
      error: null,
    });

    await expect(
      prefetchMemberPermissions(["suggestions.read", "suggestions.manage"]),
    ).rejects.toBeInstanceOf(PlatformBoundaryError);
  });

  it("throws a platform boundary error when a batch entry is non-boolean", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        "suggestions.read": "true",
        "suggestions.manage": false,
      },
      error: null,
    });

    await expect(
      prefetchMemberPermissions(["suggestions.read", "suggestions.manage"]),
    ).rejects.toBeInstanceOf(PlatformBoundaryError);
  });

  it("throws a platform boundary error when the batch payload is not an object", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      prefetchMemberPermissions(["suggestions.read", "suggestions.manage"]),
    ).rejects.toBeInstanceOf(PlatformBoundaryError);
  });

  it("accepts a well-formed batch map with explicit true and false values", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        "actions.read": true,
        "projects.read": false,
        "benefits.read": true,
      },
      error: null,
    });

    await prefetchMemberPermissions([
      "actions.read",
      "projects.read",
      "benefits.read",
    ]);

    await expect(currentMemberHasPermission("actions.read")).resolves.toBe(
      true,
    );
    await expect(currentMemberHasPermission("projects.read")).resolves.toBe(
      false,
    );
    await expect(currentMemberHasPermission("benefits.read")).resolves.toBe(
      true,
    );
  });

  it("merges a second batch request with only uncached keys", async () => {
    rpc
      .mockResolvedValueOnce({
        data: true,
        error: null,
      })
      .mockResolvedValueOnce({
        data: true,
        error: null,
      });

    await prefetchMemberPermissions(["actions.read"]);
    await prefetchMemberPermissions(["actions.read", "projects.read"]);

    await expect(currentMemberHasPermission("actions.read")).resolves.toBe(
      true,
    );
    await expect(currentMemberHasPermission("projects.read")).resolves.toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("member_has_permission", {
      target_permission_key: "projects.read",
    });
  });
});
