import { describe, expect, it } from "vitest";

import {
  pickStop,
  withTallEnds,
} from "@/components/marketing/v6/scroll-engine";

// Stops measured on the v6 page at 1280×800 (hero, statement, the five
// From-one-finding steps, the Action Card pin, then sections with their
// tall-section ends).
const VH = 800;
const STOPS = [
  0, 646, 1238, 1798, 2358, 2918, 3478, 4278, 5078, 5790, 6927, 7639, 8492,
  9204, 9854, 10770,
];

describe("v6 scroll snap", () => {
  it("carries a single wheel notch from the hero to the next section", () => {
    expect(pickStop(STOPS, 0, 100, VH)).toBe(646);
  });

  it("is direction-aware: a small scroll up returns to the section above", () => {
    expect(pickStop(STOPS, 646, 546, VH)).toBe(0);
    expect(pickStop(STOPS, 1238, 1138, VH)).toBe(646);
  });

  it("rests on each From-one-finding step, one step per gesture", () => {
    expect(pickStop(STOPS, 1238, 1338, VH)).toBe(1798);
    expect(pickStop(STOPS, 1798, 2069, VH)).toBe(2358);
    expect(pickStop(STOPS, 2358, 2087, VH)).toBe(1798);
  });

  it("eases back onto a stop the gesture just overshot", () => {
    expect(pickStop(STOPS, 0, 700, VH)).toBe(646);
    expect(pickStop(STOPS, 1798, 2900, VH)).toBe(2918);
  });

  it("lets tall sections read freely and snaps only near their edges", () => {
    expect(pickStop(STOPS, 5790, 6190, VH)).toBeNull();
    expect(pickStop(STOPS, 6100, 6700, VH)).toBe(6927);
    expect(pickStop(STOPS, 6927, 7027, VH)).toBe(7639);
    expect(pickStop(STOPS, 7639, 7539, VH)).toBe(6927);
  });

  it("returns a nudge to the stop it left and ignores nudges elsewhere", () => {
    expect(pickStop(STOPS, 646, 660, VH)).toBe(646);
    expect(pickStop(STOPS, 6100, 6110, VH)).toBeNull();
  });

  it("adds an end stop only to sections taller than the viewport", () => {
    const stops = withTallEnds(
      [
        { y: 0, margin: 0 },
        { y: 600, margin: 88 },
        { y: 2600, margin: 88 },
      ],
      VH,
    ).map((s) => s.y);
    expect(stops).toEqual([0, 600, 1888, 2600]);
  });
});
