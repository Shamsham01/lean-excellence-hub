import { describe, expect, it } from "vitest";

import { LEANAI_CREDIT_MICRO_GBP_PER_CREDIT } from "@/modules/billing/leanai-credit-policy";
import { resolveLeanAiCreditPolicyDefault } from "@/modules/billing/leanai-credit-policy";

describe("LeanAI credit micro-GBP alignment", () => {
  it("uses 1000 micro-GBP per cost credit (£0.001), matching SQL leanai_micro_gbp_per_credit()", () => {
    expect(LEANAI_CREDIT_MICRO_GBP_PER_CREDIT).toBe(1_000);
  });

  it("expresses essentials monthly allowance as illustrative £30 budget at 30k credits", () => {
    const policy = resolveLeanAiCreditPolicyDefault("essentials");
    const microBudget =
      policy.monthlyCreditAllowancePerSite * LEANAI_CREDIT_MICRO_GBP_PER_CREDIT;
    expect(microBudget).toBe(30_000_000);
    expect(microBudget / 1_000_000).toBe(30);
  });

  it("expresses professional monthly allowance as illustrative £120 budget at 120k credits", () => {
    const policy = resolveLeanAiCreditPolicyDefault("professional");
    const microBudget =
      policy.monthlyCreditAllowancePerSite * LEANAI_CREDIT_MICRO_GBP_PER_CREDIT;
    expect(microBudget / 1_000_000).toBe(120);
  });
});
