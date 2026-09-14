/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const currentMemberHasPermission = vi.fn();
const currentMemberHasScopedPermission = vi.fn();

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasPermission: (...args: unknown[]) =>
    currentMemberHasPermission(...args),
  currentMemberHasScopedPermission: (...args: unknown[]) =>
    currentMemberHasScopedPermission(...args),
}));

import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import { platformNavigation } from "@/modules/platform-shell/navigation";

describe("buildVisibleNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMemberHasPermission.mockResolvedValue(true);
    currentMemberHasScopedPermission.mockResolvedValue(true);
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
    currentMemberHasScopedPermission.mockResolvedValue(false);

    await expect(buildVisibleNavigation()).resolves.toEqual([]);
  });

  it("asks for every registered module permission", async () => {
    await buildVisibleNavigation();
    const requested = currentMemberHasPermission.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    const scoped = currentMemberHasScopedPermission.mock.calls.map(
      (call: unknown[]) => call[0],
    );

    for (const item of platformNavigation) {
      if (item.organisationScopeOnly) {
        expect(scoped).toContain(item.permission);
      } else {
        expect(requested).toContain(item.permission);
      }
    }
  });
});
