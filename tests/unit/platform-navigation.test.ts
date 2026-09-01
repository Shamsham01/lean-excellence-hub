import { describe, expect, it } from "vitest";

import {
  filterPlatformNavigation,
  groupPlatformNavigation,
  isNavActive,
  isNavItemActive,
  isSettingsNavActive,
  platformNavigation,
  settingsNavigationItem,
} from "@/modules/platform-shell/navigation";

describe("platform navigation", () => {
  it("exposes M7 people capability routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/people");
    expect(hrefs).toContain("/platform/training");
    expect(hrefs).toContain("/platform/skills");
  });

  it("exposes M9 suggestions and recognition routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/suggestions");
    expect(hrefs).toContain("/platform/recognition");
  });

  it("exposes M10 benefits routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/benefits");
  });

  it("exposes M11 problem solving routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/problem-solving");
  });

  it("exposes M6 platform routes", () => {
    const hrefs = platformNavigation.map((item) => item.href);
    expect(hrefs).toContain("/platform/5s");
    expect(hrefs).toContain("/platform/gemba");
    expect(hrefs).toContain("/platform/actions");
    expect(hrefs).toContain("/platform/templates");
  });

  it("assigns a unique icon key to every top-level module", () => {
    const icons = platformNavigation.map((item) => item.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("filters navigation items by granted permissions", () => {
    const maturityOnly = filterPlatformNavigation(new Set(["maturity.read"]));
    expect(maturityOnly.map((item) => item.href)).toContain(
      "/platform/maturity",
    );

    const actionOnly = filterPlatformNavigation(
      new Set(["actions.read", "maturity.read"]),
    );
    expect(actionOnly.map((item) => item.href)).toContain("/platform/actions");

    const templateOnly = filterPlatformNavigation(new Set(["templates.read"]));
    expect(templateOnly.map((item) => item.href)).toEqual([
      "/platform/templates",
    ]);
  });

  it("groups navigation without empty sections", () => {
    const grouped = groupPlatformNavigation(
      platformNavigation.filter((item) => item.section === "people"),
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.section).toBe("people");
    expect(grouped[0]?.items.length).toBeGreaterThan(0);
  });

  it("omits empty groups from grouped navigation", () => {
    const grouped = groupPlatformNavigation([
      platformNavigation.find((item) => item.href === "/platform")!,
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.section).toBe("main");
    expect(grouped.some((group) => group.items.length === 0)).toBe(false);
  });
});

describe("platform navigation active routes", () => {
  it("only activates home on the exact platform home route", () => {
    expect(isNavActive("/platform", "/platform")).toBe(true);
    expect(isNavActive("/platform/maturity", "/platform")).toBe(false);
    expect(isNavActive("/platform/actions", "/platform")).toBe(false);
  });

  it("activates nested module routes without false prefix matches", () => {
    expect(isNavActive("/platform/maturity/models", "/platform/maturity")).toBe(
      true,
    );
    expect(
      isNavActive("/platform/maturity/assessments/abc", "/platform/maturity"),
    ).toBe(true);
    expect(isNavActive("/platform/maturity-old", "/platform/maturity")).toBe(
      false,
    );
  });

  it("activates lean ai without activating settings", () => {
    expect(
      isNavItemActive(
        "/platform/settings/ai",
        platformNavigation.find(
          (item) => item.href === "/platform/settings/ai",
        )!,
      ),
    ).toBe(true);
    expect(isSettingsNavActive("/platform/settings/ai")).toBe(false);
  });

  it("activates settings for profile and administration routes", () => {
    expect(isSettingsNavActive("/platform/settings")).toBe(true);
    expect(isSettingsNavActive("/platform/settings/profile")).toBe(true);
    expect(isSettingsNavActive("/platform/settings/people")).toBe(true);
    expect(
      isNavItemActive("/platform/settings/profile", settingsNavigationItem),
    ).toBe(true);
  });
});
