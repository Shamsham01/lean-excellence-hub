import { describe, expect, it } from "vitest";

import {
  clampProgress,
  easeKnock,
  easeOutCubic,
  mapRange,
  sceneProgress,
} from "@/components/marketing/kinetic/math";

describe("kinetic progress helpers", () => {
  it("clamps and maps a scene range", () => {
    expect(clampProgress(-0.2)).toBe(0);
    expect(clampProgress(1.4)).toBe(1);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(mapRange(0.25, 0.25, 0.75)).toBe(0);
    expect(mapRange(0.5, 0.25, 0.75)).toBe(0.5);
    expect(mapRange(1, 0.25, 0.75)).toBe(1);
    expect(mapRange(0.5, 0, 1, 10, 20)).toBe(15);
  });

  it("derives reversible scene progress from geometry", () => {
    expect(sceneProgress(0, 800, 400)).toBe(0);
    expect(sceneProgress(-200, 800, 400)).toBe(0.5);
    expect(sceneProgress(-400, 800, 400)).toBe(1);
    expect(sceneProgress(-800, 800, 400)).toBe(1);
    expect(sceneProgress(40, 800, 400)).toBe(0);
    expect(sceneProgress(0, 300, 400)).toBe(1);
  });

  it("eases without leaving the unit interval at the ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeKnock(0)).toBe(0);
    expect(easeKnock(1)).toBe(1);
    expect(easeKnock(0.5)).toBeGreaterThan(0.5);
  });
});
