import { describe, expect, it } from "vitest";

import { THREAD_STEPS } from "@/components/marketing/v6/content";
import {
  LIFT_AIR,
  liftFits,
  liftStyle,
} from "@/components/marketing/v6/thread-carousel";

describe("finding story lifted tiles (ATELIER 2b)", () => {
  it("gives every step one tile inside its own desktop capture", () => {
    for (const step of THREAD_STEPS) {
      const slot = step.desktop;
      const lift = step.lift;
      expect(slot, step.id).toBeTruthy();
      expect(lift, step.id).toBeTruthy();
      if (!slot || !lift) {
        continue;
      }
      const shift = step.shift ?? 0;
      expect(lift.x).toBeGreaterThanOrEqual(0);
      expect(lift.y).toBeGreaterThanOrEqual(shift);
      expect(lift.x + lift.w).toBeLessThanOrEqual(slot.width);
      expect(lift.y + lift.h).toBeLessThanOrEqual(slot.height);
      expect(lift.r).toBeGreaterThan(0);
    }
  });

  it("maps the tile to percentages of the capture width", () => {
    const act = THREAD_STEPS.find((s) => s.id === "act");
    expect(act).toBeTruthy();
    const style = liftStyle(act!) as Record<string, string>;
    expect(style["--lx"]).toBe(((1 / 2400) * 100).toFixed(4));
    expect(style["--ly"]).toBe(((13 / 2400) * 100).toFixed(4));
    expect(style["--sy"]).toBe("0.0000");
  });

  it("keeps the tile flat when the window is too short for it", () => {
    const learn = THREAD_STEPS.find((s) => s.id === "learn")!;
    const slot = learn.desktop!;
    const lift = learn.lift!;
    const width = 1200;
    const bottom =
      ((lift.y + lift.h - (learn.shift ?? 0)) / slot.width) * width +
      lift.h * 0.02 * (width / slot.width);
    expect(liftFits(learn, width, Math.ceil(bottom + LIFT_AIR))).toBe(true);
    expect(liftFits(learn, width, Math.floor(bottom + LIFT_AIR - 1))).toBe(
      false,
    );
    expect(liftFits(learn, 0, 900)).toBe(false);
  });
});
