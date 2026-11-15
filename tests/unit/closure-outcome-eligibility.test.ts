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
      resolvedClosureBlockedByEffectiveness(
        [{ result: "pass" }, { result: "inconclusive" }],
        true,
      ),
    ).toBe(true);
    expect(
      resolvedClosureBlockedByEffectiveness([{ result: "fail" }], true),
    ).toBe(true);
    expect(
      resolvedClosureBlockedByEffectiveness([{ result: null }], true),
    ).toBe(true);
  });

  it("does not block resolved closure without corrective countermeasures", () => {
    expect(
      resolvedClosureBlockedByEffectiveness(
        [{ result: "inconclusive" }],
        false,
      ),
    ).toBe(false);
  });

  it("exposes a stable user-facing block reason", () => {
    expect(RESOLVED_CLOSURE_EFFECTIVENESS_BLOCK_REASON).toMatch(
      /must pass before closing as resolved/i,
    );
  });
});
