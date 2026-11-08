import { describe, expect, it } from "vitest";

import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import {
  entitlementCapabilityGranted,
  planCapabilityMessage,
} from "@/modules/billing/plan-capabilities";

describe("plan capabilities", () => {
  it("maps Essentials vs Professional flags from the catalogue", () => {
    expect(
      entitlementCapabilityGranted(
        PLAN_CATALOGUE.essentials.entitlements,
        "advancedAnalytics",
      ),
    ).toBe(false);
    expect(
      entitlementCapabilityGranted(
        PLAN_CATALOGUE.professional.entitlements,
        "advancedBenefitsGovernance",
      ),
    ).toBe(true);
  });

  it("returns upgrade copy with billing link targets", () => {
    const copy = planCapabilityMessage("advancedAnalytics");
    expect(copy.title).toContain("Professional");
    expect(copy.description.toLowerCase()).toContain("analytics");
  });
});
