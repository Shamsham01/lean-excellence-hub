import { describe, expect, it } from "vitest";

import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
import { platformNavigation } from "@/modules/platform-shell/navigation";

describe("platform home fallback permissions", () => {
  it("includes every module permission except Home, maturity.read, and Lean AI settings", () => {
    const modulePermissions = new Set(
      platformNavigation
        .filter(
          (item) =>
            item.href !== "/platform" && item.href !== "/platform/settings/ai",
        )
        .map((item) => item.permission)
        .filter((permission) => permission !== "maturity.read"),
    );

    expect(new Set(platformHomeFallbackPermissions)).toEqual(modulePermissions);
  });

  it("includes benefits.read for benefits-only roles", () => {
    expect(platformHomeFallbackPermissions).toContain("benefits.read");
  });

  it("includes projects.read and problem_solving.view", () => {
    expect(platformHomeFallbackPermissions).toContain("projects.read");
    expect(platformHomeFallbackPermissions).toContain("problem_solving.view");
  });

  it("does not include maturity.read because Home already uses it", () => {
    expect(platformHomeFallbackPermissions).not.toContain("maturity.read");
  });
});
