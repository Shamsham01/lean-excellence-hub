import { describe, expect, it } from "vitest";

import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import {
  organisationHasEntitlement,
  resolveOrganisationEntitlements,
} from "@/modules/billing/entitlements";

describe("entitlement resolution", () => {
  it("does not infer capabilities from plan-name conditionals in callers", () => {
    const professional = resolveOrganisationEntitlements({
      planCode: "professional",
      billingState: "active",
    });
    const founder = resolveOrganisationEntitlements({
      planCode: "founder",
      billingState: "active",
    });

    expect(professional.coreModules).toBe(true);
    expect(professional.advancedBenefitsGovernance).toBe(true);
    expect(founder).toEqual(professional);
    expect(organisationHasEntitlement(professional, "coreModules")).toBe(true);
  });

  it("keeps unfinished Enterprise capabilities disabled", () => {
    const entitlements = resolveOrganisationEntitlements({
      planCode: "enterprise",
      billingState: "active",
    });

    expect(entitlements.coreModules).toBe(true);
    expect(entitlements.enterpriseSso).toBe(false);
    expect(entitlements.enterpriseGovernance).toBe(false);
    expect(entitlements.crossSiteBenchmarking).toBe(false);
    expect(entitlements.advancedAuditRetention).toBe(false);
  });

  it("does not grant operational modules while billing is pending or ended", () => {
    expect(
      resolveOrganisationEntitlements({
        planCode: "professional",
        billingState: "pending",
      }).coreModules,
    ).toBe(false);
    expect(
      resolveOrganisationEntitlements({
        planCode: "professional",
        billingState: "ended",
      }).coreModules,
    ).toBe(false);
  });

  it("treats organisations without a subscription as unmetered legacy Professional", () => {
    expect(
      resolveOrganisationEntitlements({
        planCode: null,
        billingState: null,
        hasLegacyUnmeteredAccess: true,
      }),
    ).toEqual(PLAN_CATALOGUE.professional.entitlements);
  });
});
