import { describe, expect, it } from "vitest";

import {
  scoreAnswerFromMetadata,
  validateScoringMetadata,
  weightedMean,
} from "@/modules/maturity/scoring";

describe("maturity scoring", () => {
  it("validates direct score metadata", () => {
    expect(validateScoringMetadata("score", true, { type: "direct" })).toBe(
      true,
    );
    expect(validateScoringMetadata("score", true, null)).toBe(false);
  });

  it("validates yes/no scoring metadata", () => {
    expect(
      validateScoringMetadata("yes_no", true, {
        type: "yes_no",
        yes_value: 5,
        no_value: 1,
      }),
    ).toBe(true);
  });

  it("scores direct numeric answers", () => {
    expect(
      scoreAnswerFromMetadata(
        "score",
        true,
        { type: "direct" },
        {
          number_value: 4,
        },
      ),
    ).toBe(4);
  });

  it("excludes non-scoring questions", () => {
    expect(
      scoreAnswerFromMetadata("long_text", false, null, {
        text_value: "notes",
      }),
    ).toBeNull();
  });

  it("computes weighted mean", () => {
    expect(
      weightedMean([
        { value: 4, weight: 1 },
        { value: 2, weight: 1 },
      ]),
    ).toBe(3);
  });
});
