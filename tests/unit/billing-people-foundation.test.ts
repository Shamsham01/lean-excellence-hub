import { describe, expect, it } from "vitest";

import {
  PEOPLE_FOUNDATION_ROUTE_PREFIXES,
  PEOPLE_HR_PAID_MODULE,
  PEOPLE_HR_ROUTE_PREFIXES,
} from "@/modules/billing/people-product-surfaces";
import { buildPlanModuleEntitlements } from "@/modules/billing/module-entitlements";

describe("people foundation vs paid HR", () => {
  it("keeps job functions off the paid HR route list", () => {
    const jobFunctionsPath = "/platform/settings/job-functions";
    const hrPrefixes = PEOPLE_HR_ROUTE_PREFIXES as readonly string[];
    expect(
      hrPrefixes.some((prefix) => jobFunctionsPath.startsWith(prefix)),
    ).toBe(false);
  });

  it("keeps invitations/settings root off the paid HR route list", () => {
    expect(PEOPLE_FOUNDATION_ROUTE_PREFIXES).toContain(
      "/platform/settings/people",
    );
    expect(
      (PEOPLE_HR_ROUTE_PREFIXES as readonly string[]).includes(
        "/platform/settings/people",
      ),
    ).toBe(false);
    expect(PEOPLE_HR_ROUTE_PREFIXES).toContain(
      "/platform/settings/people/create",
    );
  });

  it("allows essentials RBAC people flows without people_hr module flag", () => {
    const essentials = buildPlanModuleEntitlements({
      planCode: "essentials",
      legacyGrandfather: false,
    });
    expect(essentials.suggestions).toBe(true);
    expect(essentials[PEOPLE_HR_PAID_MODULE]).toBe(false);
  });
});
