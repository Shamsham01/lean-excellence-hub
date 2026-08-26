import { describe, expect, it } from "vitest";

import {
  benefitClassLabel,
  financialTypeLabel,
  isFinancialBenefit,
  nonFinancialTypeLabel,
} from "@/lib/benefits/classification";
import {
  benefitStatusBadgeVariant,
  benefitStatusLabel,
  canTransitionBenefitStatus,
  isBenefitEditable,
  pipelineStatuses,
} from "@/lib/benefits/status";

describe("benefit lifecycle presentation", () => {
  it("formats benefit status labels", () => {
    expect(benefitStatusLabel("realising")).toBe("Realising");
    expect(benefitStatusLabel("submitted")).toBe("Submitted");
  });

  it("returns badge variants for lifecycle states", () => {
    expect(benefitStatusBadgeVariant("draft")).toBe("secondary");
    expect(benefitStatusBadgeVariant("rejected")).toBe("destructive");
  });

  it("marks only draft benefits as editable", () => {
    expect(isBenefitEditable("draft")).toBe(true);
    expect(isBenefitEditable("submitted")).toBe(false);
  });

  it("allows legal lifecycle transitions", () => {
    expect(canTransitionBenefitStatus("draft", "submitted")).toBe(true);
    expect(canTransitionBenefitStatus("submitted", "approved")).toBe(true);
    expect(canTransitionBenefitStatus("draft", "approved")).toBe(false);
  });

  it("returns pipeline statuses", () => {
    expect(pipelineStatuses()).toEqual([
      "submitted",
      "approved",
      "realising",
      "realised",
    ]);
  });
});

describe("benefit classification presentation", () => {
  it("labels financial and non-financial classes", () => {
    expect(isFinancialBenefit("financial")).toBe(true);
    expect(benefitClassLabel("financial")).toBe("Financial");
    expect(benefitClassLabel("non_financial")).toBe("Non-Financial");
  });

  it("labels financial and non-financial types", () => {
    expect(financialTypeLabel("hard_saving")).toBe("Hard Saving");
    expect(nonFinancialTypeLabel("quality")).toBe("Quality");
  });
});
