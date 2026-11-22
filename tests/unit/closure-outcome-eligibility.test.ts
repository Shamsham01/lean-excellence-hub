import { describe, expect, it } from "vitest";

import {
  RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON,
  hasCorrectiveCountermeasuresForClosure,
  resolvedClosureBlockedByEffectiveness,
} from "@/lib/problem-solving/closure";

describe("closure outcome eligibility", () => {
  it("treats selected countermeasures as requiring effectiveness for resolved closure", () => {
    expect(
      hasCorrectiveCountermeasuresForClosure([
        { status: "proposed" },
        { status: "selected" },
      ]),
    ).toBe(true);
  });

  it("blocks resolved closure when any check is inconclusive or fail", () => {
    expect(
      resolvedClosureBlockedByEffectiveness([
        { result: "pass" },
        { result: "inconclusive" },
      ]),
    ).toBe(true);
    expect(resolvedClosureBlockedByEffectiveness([{ result: "fail" }])).toBe(
      true,
    );
    expect(resolvedClosureBlockedByEffectiveness([{ result: null }])).toBe(
      true,
    );
  });

  it("blocks resolved closure when checks exist regardless of countermeasure status", () => {
    expect(
      resolvedClosureBlockedByEffectiveness([{ result: "inconclusive" }]),
    ).toBe(true);
    expect(resolvedClosureBlockedByEffectiveness([])).toBe(false);
  });

  it("exposes a stable user-facing block reason", () => {
    expect(RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON).toMatch(
      /must pass before closing as resolved/i,
    );
  });
});
