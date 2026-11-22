import { describe, expect, it } from "vitest";

import {
  LEH_COMMERCIAL_PRINCIPLES,
  UNLIMITED_MEMBERSHIP_PER_SITE,
} from "@/modules/billing/commercial-principles";
import {
  LEH_COMMERCIAL_PRINCIPLES as CATALOGUE_EXPORT,
  PLAN_CATALOGUE,
  UNLIMITED_MEMBERSHIP_PER_SITE as CATALOGUE_FLAG,
} from "@/modules/billing/catalogue";
import { resolvePooledMonthlyCreditAllowance } from "@/modules/billing/leanai-credit-policy";

describe("commercial principles (founder t116u)", () => {
  it("asserts unlimited membership per site on all catalogue plans", () => {
    expect(UNLIMITED_MEMBERSHIP_PER_SITE).toBe(true);
    expect(CATALOGUE_FLAG).toBe(true);
    expect(LEH_COMMERCIAL_PRINCIPLES).toEqual(CATALOGUE_EXPORT);
    expect(LEH_COMMERCIAL_PRINCIPLES.chargesPerUser).toBe(false);
    expect(LEH_COMMERCIAL_PRINCIPLES.billedUnit).toBe("site");

    for (const plan of Object.values(PLAN_CATALOGUE)) {
      expect(plan.monthlySitePriceMinor).toBeGreaterThan(0);
      expect(plan.entitlements.coreModules).toBe(true);
    }
  });

  it("scales LeanAI candidate credits by subscribed site quantity, not headcount", () => {
    const oneSite = resolvePooledMonthlyCreditAllowance({
      planCode: "essentials",
      siteQuantity: 1,
    });
    const threeSites = resolvePooledMonthlyCreditAllowance({
      planCode: "essentials",
      siteQuantity: 3,
    });
    expect(threeSites).toBe(oneSite * 3);
  });
});
