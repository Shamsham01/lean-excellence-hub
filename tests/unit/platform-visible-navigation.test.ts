/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const currentMemberHasPermission = vi.fn();
const currentMemberHasGrantPermission = vi.fn();
const currentMemberHasScopedPermission = vi.fn();
const prefetchMemberPermissions = vi.fn();

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasPermission: (...args: unknown[]) =>
    currentMemberHasPermission(...args),
  currentMemberHasGrantPermission: (...args: unknown[]) =>
    currentMemberHasGrantPermission(...args),
  currentMemberHasScopedPermission: (...args: unknown[]) =>
    currentMemberHasScopedPermission(...args),
  prefetchMemberPermissions: (...args: unknown[]) =>
    prefetchMemberPermissions(...args),
}));

import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import { platformNavigation } from "@/modules/platform-shell/navigation";
import { collectPlatformShellPermissionKeys } from "@/modules/platform-shell/shell-permission-keys";

describe("buildVisibleNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMemberHasPermission.mockResolvedValue(true);
    currentMemberHasGrantPermission.mockResolvedValue(true);
    currentMemberHasScopedPermission.mockResolvedValue(true);
    prefetchMemberPermissions.mockResolvedValue(undefined);
  });

  it("prefetches shell permission keys before nav probes", async () => {
    await buildVisibleNavigation();

    expect(prefetchMemberPermissions).toHaveBeenCalledTimes(1);
    expect(prefetchMemberPermissions).toHaveBeenCalledWith(
      collectPlatformShellPermissionKeys(),
    );
  });

  it("keeps navigation available across repeated permission-check cycles", async () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const items = await buildVisibleNavigation();
      expect(items.some((item) => item.href === "/platform/gemba")).toBe(true);
      expect(items.some((item) => item.href === "/platform/people")).toBe(true);
    }
  });

  it("does not throw when permission probes fail closed", async () => {
    currentMemberHasPermission.mockResolvedValue(false);
    currentMemberHasGrantPermission.mockResolvedValue(false);
    currentMemberHasScopedPermission.mockResolvedValue(false);

    await expect(buildVisibleNavigation()).resolves.toEqual([]);
  });

  it("asks the grant probe for module permissions and keeps view permissions separate", async () => {
    await buildVisibleNavigation();
    const participation = currentMemberHasPermission.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    const grants = currentMemberHasGrantPermission.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    const scoped = currentMemberHasScopedPermission.mock.calls.map(
      (call: unknown[]) => call[0],
    );

    for (const item of platformNavigation) {
      if (item.organisationScopeOnly) {
        expect(scoped).toContain(item.permission);
      } else {
        expect(grants).toContain(item.permission);
        expect(participation).not.toContain(item.permission);
      }
    }
  });

  it("shows 5S for Workplace Viewer without treating baseline read as a grant", async () => {
    currentMemberHasGrantPermission.mockResolvedValue(false);
    currentMemberHasScopedPermission.mockResolvedValue(false);
    currentMemberHasPermission.mockImplementation(
      async (permission: string) => permission === "workplace.view",
    );

    const items = await buildVisibleNavigation();

    expect(items.some((item) => item.href === "/platform/5s")).toBe(true);
    expect(items.some((item) => item.href === "/platform/gemba")).toBe(true);
    expect(items.some((item) => item.href === "/platform/people")).toBe(false);
  });

  it("shows Suggestions from submit access without a suggestions.read grant", async () => {
    currentMemberHasGrantPermission.mockResolvedValue(false);
    currentMemberHasScopedPermission.mockResolvedValue(false);
    currentMemberHasPermission.mockImplementation(
      async (permission: string) => permission === "suggestions.submit",
    );

    const items = await buildVisibleNavigation();

    expect(items.some((item) => item.href === "/platform/suggestions")).toBe(
      true,
    );
    expect(items.some((item) => item.href === "/platform/5s")).toBe(false);
  });
});
