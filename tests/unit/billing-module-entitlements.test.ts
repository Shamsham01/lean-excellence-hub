import { describe, expect, it } from "vitest";

import { resolveOrganisationEntitlements } from "@/modules/billing/entitlements";
import { organisationHasModuleEntitlement } from "@/modules/billing/module-entitlements";

describe("module entitlements", () => {
  it("grants essentials core modules only", () => {
    const entitlements = resolveOrganisationEntitlements({
      planCode: "essentials",
      billingState: "active",
    });
    expect(organisationHasModuleEntitlement(entitlements, "maturity")).toBe(
      true,
    );
    expect(organisationHasModuleEntitlement(entitlements, "benefits")).toBe(
      false,
    );
    expect(organisationHasModuleEntitlement(entitlements, "projects")).toBe(
      false,
    );
  });

  it("grants professional full module set", () => {
    const entitlements = resolveOrganisationEntitlements({
      planCode: "professional",
      billingState: "active",
    });
    expect(organisationHasModuleEntitlement(entitlements, "benefits")).toBe(
      true,
    );
    expect(
      organisationHasModuleEntitlement(entitlements, "problem_solving"),
    ).toBe(true);
  });

  it("grandfathers legacy organisations to all modules", () => {
    const entitlements = resolveOrganisationEntitlements({
      planCode: null,
      billingState: null,
      hasLegacyUnmeteredAccess: true,
    });
    expect(organisationHasModuleEntitlement(entitlements, "benefits")).toBe(
      true,
    );
  });
});
