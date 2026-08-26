import { describe, expect, it } from "vitest";

import {
  applyPortfolioAllocation,
  computeCumulativeRealised,
  formatVariance,
  realisationEntryStatusLabel,
} from "@/lib/benefits/realisation";

describe("benefit realisation helpers", () => {
  it("applies portfolio allocation percentages", () => {
    expect(applyPortfolioAllocation(10_000, 80)).toBe(8_000);
  });

  it("computes cumulative validated realised totals only", () => {
    const total = computeCumulativeRealised([
      { financialAmount: 1_000, status: "validated" },
      { financialAmount: 500, status: "submitted" },
      { financialAmount: 250, status: "validated" },
    ]);

    expect(total).toBe(1_250);
  });

  it("formats variance direction", () => {
    expect(formatVariance(1_000, 1_200)).toEqual({
      value: 200,
      direction: "over",
    });
    expect(formatVariance(1_000, 800)).toEqual({
      value: -200,
      direction: "under",
    });
  });

  it("labels realisation entry statuses", () => {
    expect(realisationEntryStatusLabel("validated")).toBe("Validated");
    expect(realisationEntryStatusLabel("submitted")).toBe("Awaiting Validation");
  });
});
