import { describe, expect, it } from "vitest";

import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import {
  describeLeanAiCustomerInclusion,
  LEANAI_FAIR_USE_STATEMENT,
  LEANAI_PLAN_ALLOWANCE_ENFORCED,
} from "@/modules/billing/leanai-inclusion";

const FORBIDDEN =
  /unlimited|500,000|2,000,000|500000|2000000|margin|openai|\$/i;

function expectCustomerCopy(value: {
  planLabel: string;
  statement: string;
  siteNote: string;
}) {
  expect(`${value.planLabel} ${value.statement} ${value.siteNote}`).not.toMatch(
    FORBIDDEN,
  );
}

describe("describeLeanAiCustomerInclusion", () => {
  it("keeps catalogue allowances out of enforcement", () => {
    expect(LEANAI_PLAN_ALLOWANCE_ENFORCED).toBe(false);
    expect(
      PLAN_CATALOGUE.essentials.entitlements.leanAiMonthlyTokenAllowance,
    ).toBe(500_000);
    expect(
      PLAN_CATALOGUE.professional.entitlements.leanAiMonthlyTokenAllowance,
    ).toBe(2_000_000);
    expect(
      PLAN_CATALOGUE.founder.entitlements.leanAiMonthlyTokenAllowance,
    ).toBe(2_000_000);
    expect(
      PLAN_CATALOGUE.enterprise.entitlements.leanAiMonthlyTokenAllowance,
    ).toBeNull();
  });

  it.each([
    ["essentials", "Essentials"],
    ["professional", "Professional"],
    ["founder", "Founder Pilot"],
    ["enterprise", "Enterprise"],
  ] as const)(
    "includes %s without a published token quota",
    (planCode, label) => {
      const result = describeLeanAiCustomerInclusion({
        planCode,
        billingState: "active",
        organisationStatus: "active",
      });

      expect(result.state).toBe("included");
      expect(result.planLabel).toBe(label);
      expect(result.statement).toContain(LEANAI_FAIR_USE_STATEMENT);
      expect(result.statement).toContain("no AI overage invoice");
      expect(result.siteNote).toMatch(/one shared organisation total/i);
      expectCustomerCopy(result);
    },
  );

  it("includes operational billing states and withholds inactive ones", () => {
    for (const billingState of [
      "trialing",
      "past_due",
      "cancel_at_period_end",
    ] as const) {
      expect(
        describeLeanAiCustomerInclusion({
          planCode: "professional",
          billingState,
          organisationStatus: "active",
        }).state,
      ).toBe("included");
    }

    for (const billingState of ["pending", "suspended", "ended"] as const) {
      const result = describeLeanAiCustomerInclusion({
        planCode: "essentials",
        billingState,
        organisationStatus: "active",
      });
      expect(result.state).toBe("unavailable");
      expectCustomerCopy(result);
    }
  });

  it("describes legacy access without turning a missing plan into unlimited use", () => {
    const legacy = describeLeanAiCustomerInclusion({
      planCode: null,
      billingState: null,
      organisationStatus: "active",
    });
    expect(legacy.state).toBe("legacy");
    expect(legacy.statement).toContain(LEANAI_FAIR_USE_STATEMENT);
    expectCustomerCopy(legacy);

    const none = describeLeanAiCustomerInclusion({
      planCode: null,
      billingState: null,
      organisationStatus: "provisioning",
    });
    expect(none.state).toBe("unavailable");
    expect(none.planLabel).toBe("No active subscription");
    expectCustomerCopy(none);
  });

  it("does not invent inclusion when billing cannot be loaded", () => {
    const result = describeLeanAiCustomerInclusion({
      planCode: "enterprise",
      billingState: "active",
      organisationStatus: "active",
      billingUnavailable: true,
    });
    expect(result.state).toBe("unknown");
    expect(result.statement).toMatch(/could not be loaded/i);
    expectCustomerCopy(result);
  });
});
