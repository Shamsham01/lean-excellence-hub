import { describe, expect, it } from "vitest";

import {
  filterPlatformNavigation,
  platformNavigation,
} from "@/modules/platform-shell/navigation";

describe("platform navigation", () => {
  it("only exposes implemented platform routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/actions");
    expect(hrefs).toContain("/platform/templates");
    expect(hrefs.every((href) => !href.includes("gemba"))).toBe(true);
  });

  it("filters navigation items by granted permissions", () => {
    const maturityOnly = filterPlatformNavigation(new Set(["maturity.read"]));
    expect(maturityOnly.map((item) => item.href)).toContain("/platform/maturity");

    const actionOnly = filterPlatformNavigation(
      new Set(["actions.read", "maturity.read"]),
    );
    expect(actionOnly.map((item) => item.href)).toContain("/platform/actions");

    const templateOnly = filterPlatformNavigation(new Set(["templates.read"]));
    expect(templateOnly.map((item) => item.href)).toEqual([
      "/platform/templates",
    ]);
  });
});
