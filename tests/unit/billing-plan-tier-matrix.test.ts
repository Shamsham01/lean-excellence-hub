import { describe, expect, it } from "vitest";

import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import {
  buildPlanModuleEntitlements,
  PLAN_MODULE_CODES,
} from "@/modules/billing/module-entitlements";
import { UNLIMITED_MEMBERSHIP_PER_SITE } from "@/modules/billing/commercial-principles";

const ESSENTIALS_MODULES = new Set([
  "maturity",
  "five_s",
  "gemba",
  "actions",
  "suggestions",
  "schedule",
  "templates",
]);

describe("plan tier module matrix", () => {
  it("covers four catalogue tiers with unlimited people per site", () => {
    for (const code of [
      "essentials",
      "professional",
      "founder",
      "enterprise",
    ] as const) {
      expect(PLAN_CATALOGUE[code].monthlySitePriceMinor).toBeGreaterThan(0);
    }
    expect(PLAN_CATALOGUE.essentials.setupFeeMinor).toBeNull();
    expect(PLAN_CATALOGUE.professional.setupFeeMinor).toBeNull();
    expect(PLAN_CATALOGUE.founder.setupFeeMinor).toBe(0);
    expect(PLAN_CATALOGUE.enterprise.setupFeeMinor).toBeNull();
    expect(UNLIMITED_MEMBERSHIP_PER_SITE).toBe(true);
  });

  it("maps essentials vs professional modules", () => {
    const essentials = buildPlanModuleEntitlements({
      planCode: "essentials",
      legacyGrandfather: false,
    });
    const professional = buildPlanModuleEntitlements({
      planCode: "professional",
      legacyGrandfather: false,
    });
    for (const code of PLAN_MODULE_CODES) {
      if (ESSENTIALS_MODULES.has(code)) {
        expect(essentials[code]).toBe(true);
      } else {
        expect(essentials[code]).toBe(false);
        expect(professional[code]).toBe(true);
      }
    }
  });

  it("grandfathers legacy null plan to full modules", () => {
    const legacy = buildPlanModuleEntitlements({
      planCode: null,
      legacyGrandfather: true,
    });
    for (const code of PLAN_MODULE_CODES) {
      expect(legacy[code]).toBe(true);
    }
  });
});
