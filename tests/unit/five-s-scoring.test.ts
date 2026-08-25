import { describe, expect, it } from "vitest";

import {
  scoreAnswerFromMetadata,
  weightedMean,
} from "@/modules/maturity/scoring";

describe("five_s scoring helpers", () => {
  it("scores yes_no answers for 5S audits", () => {
    const metadata = { type: "yes_no" as const, yes_value: 100, no_value: 0 };
    expect(
      scoreAnswerFromMetadata("yes_no", true, metadata, { text_value: "yes" }),
    ).toBe(100);
    expect(
      scoreAnswerFromMetadata("yes_no", true, metadata, { text_value: "no" }),
    ).toBe(0);
  });

  it("computes section weighted mean for all-yes 5S sections", () => {
    expect(
      weightedMean([
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
      ]),
    ).toBe(100);
  });
});
