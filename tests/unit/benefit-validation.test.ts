import { describe, expect, it } from "vitest";

import {
  deriveBenefitValidationState,
  validationDecisionLabel,
  validationRoleLabel,
  validationStateLabel,
} from "@/lib/benefits/validation";

describe("benefit validation helpers", () => {
  it("labels validation roles and decisions", () => {
    expect(validationRoleLabel("finance")).toBe("Finance");
    expect(validationDecisionLabel("needs_more_information")).toBe(
      "Needs More Information",
    );
  });

  it("derives awaiting CI state for submitted financial benefits", () => {
    expect(
      deriveBenefitValidationState({
        benefitStatus: "submitted",
        benefitClass: "financial",
      }),
    ).toBe("awaiting_ci");
  });

  it("derives awaiting finance after CI approval", () => {
    expect(
      deriveBenefitValidationState({
        benefitStatus: "submitted",
        benefitClass: "financial",
        ciDecision: "approve",
      }),
    ).toBe("awaiting_finance");
  });

  it("labels validation states", () => {
    expect(validationStateLabel("awaiting_finance")).toBe(
      "Awaiting Finance Validation",
    );
  });
});
