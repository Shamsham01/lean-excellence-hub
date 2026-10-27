import { describe, expect, it } from "vitest";

import {
  explicitFiveSScalesFromPreference,
  fiveSScaleUsesDiscreteControl,
  fiveSScaleValues,
  formatFiveSScalePreview,
  LEGACY_FIVE_S_SCORING_SCALE,
  normaliseFiveSScorePercent,
  parseFiveSScoreInput,
  resolveFiveSScoringScale,
  scoreIsOnFiveSScale,
} from "@/modules/5s/scoring-scale";

const oneToFive = { min: 1, max: 5, step: 1 };

describe("5S scoring scale", () => {
  it("maps a 1 to 5 scale onto 0 to 100 percent", () => {
    expect(normaliseFiveSScorePercent(1, oneToFive)).toBe(0);
    expect(normaliseFiveSScorePercent(3, oneToFive)).toBe(50);
    expect(normaliseFiveSScorePercent(5, oneToFive)).toBe(100);
    expect(formatFiveSScalePreview(oneToFive)).toContain("3 is 50%");
  });

  it("keeps a missing scale on the legacy 0 to 100 interpretation", () => {
    expect(resolveFiveSScoringScale(null)).toEqual(LEGACY_FIVE_S_SCORING_SCALE);
    expect(normaliseFiveSScorePercent(13, LEGACY_FIVE_S_SCORING_SCALE)).toBe(
      13,
    );
    expect(scoreIsOnFiveSScale(13, LEGACY_FIVE_S_SCORING_SCALE)).toBe(true);
    expect(scoreIsOnFiveSScale(101, LEGACY_FIVE_S_SCORING_SCALE)).toBe(false);
  });

  it("rejects values that are outside the scale or off the step", () => {
    for (const value of [
      0,
      -1,
      5.5,
      13,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(scoreIsOnFiveSScale(value, oneToFive)).toBe(false);
    }
    expect(parseFiveSScoreInput("")).toBeNull();
    expect(parseFiveSScoreInput("NaN")).toBeUndefined();
    expect(parseFiveSScoreInput("13")).toBe(13);
    expect(fiveSScaleValues(oneToFive)).toEqual([1, 2, 3, 4, 5]);
    expect(fiveSScaleUsesDiscreteControl(oneToFive)).toBe(true);
    expect(fiveSScaleUsesDiscreteControl(LEGACY_FIVE_S_SCORING_SCALE)).toBe(
      false,
    );
  });

  it("adopts one unambiguous scoring preference and ignores a vague note", () => {
    expect(explicitFiveSScalesFromPreference("Please use 1 to 5.")).toEqual([
      oneToFive,
    ]);
    expect(explicitFiveSScalesFromPreference("0-10 or 0-100")).toHaveLength(2);
    expect(
      explicitFiveSScalesFromPreference("Yes/no and a simple score."),
    ).toEqual([]);
  });
});
