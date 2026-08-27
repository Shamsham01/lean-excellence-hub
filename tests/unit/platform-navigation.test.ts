import { describe, expect, it } from "vitest";

import {
  filterPlatformNavigation,
  platformNavigation,
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
});
