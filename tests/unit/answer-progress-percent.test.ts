import { describe, expect, it } from "vitest";

import { answerProgressPercent } from "@/modules/operational/answer-progress-percent";

describe("answerProgressPercent", () => {
  it("uses floor and only reaches 100 when fully answered", () => {
    expect(answerProgressPercent(199, 200)).toBe(99);
    expect(answerProgressPercent(200, 200)).toBe(100);
    expect(answerProgressPercent(0, 5)).toBe(0);
  });
});
