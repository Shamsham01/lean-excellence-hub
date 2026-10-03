import { describe, expect, it } from "vitest";

import {
  isExpectedMaturityLifecycleError,
  maturityLifecycleErrorMessage,
} from "@/modules/maturity/assessment-action-errors";

describe("maturity lifecycle action errors", () => {
  it("treats unanswered required questions as expected domain validation", () => {
    expect(
      isExpectedMaturityLifecycleError(
        "required maturity assessment questions are unanswered",
      ),
    ).toBe(true);
    expect(
      maturityLifecycleErrorMessage(
        "required maturity assessment questions are unanswered",
        3,
      ),
    ).toBe(
      "3 required responses remaining. Review missing responses before completing.",
    );
  });

  it("maps permission and lifecycle denials without using the raw SQL exception as the only UX", () => {
    expect(
      isExpectedMaturityLifecycleError(
        "self assessment completion is not authorised",
      ),
    ).toBe(true);
    expect(
      maturityLifecycleErrorMessage("self assessment is not completable"),
    ).toMatch(/not in a state/);
  });
});
