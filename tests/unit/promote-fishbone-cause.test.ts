import { describe, expect, it } from "vitest";

import { validateFishboneCausePromotion } from "@/lib/problem-solving/promote-fishbone-cause";

describe("validateFishboneCausePromotion", () => {
  it("blocks promotion when a hypothesis is already linked", () => {
    const result = validateFishboneCausePromotion({
      linkedHypothesisId: "existing-hypothesis",
      label: "Worn guide roller",
      category: "machine",
    });
    expect(result).toEqual({
      error: "This cause is already promoted to a hypothesis.",
    });
  });

  it("requires a label and category", () => {
    expect(
      validateFishboneCausePromotion({
        linkedHypothesisId: null,
        label: "   ",
        category: "machine",
      }),
    ).toEqual({ error: "Cause label is required." });
    expect(
      validateFishboneCausePromotion({
        linkedHypothesisId: null,
        label: "Cause",
        category: " ",
      }),
    ).toEqual({ error: "Fishbone category is required." });
  });
});
