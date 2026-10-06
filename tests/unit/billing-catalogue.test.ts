import { describe, expect, it } from "vitest";

import {
  ANNUAL_DISCOUNT_PERCENT,
  annualSitePriceMinor,
  isCheckoutPlan,
  isSelfServicePlan,
  listPublicPlans,
  MAX_SITE_QUANTITY,
  MIN_SITE_QUANTITY,
  PLAN_CATALOGUE,
  resolveListedPriceMinor,
  stripePriceEnvKey,
} from "@/modules/billing/catalogue";

describe("plan catalogue", () => {
  it("keeps the commercial baseline prices in pence", () => {
    expect(PLAN_CATALOGUE.essentials.monthlySitePriceMinor).toBe(49_900);
    expect(PLAN_CATALOGUE.professional.monthlySitePriceMinor).toBe(99_900);
    expect(PLAN_CATALOGUE.enterprise.monthlySitePriceMinor).toBe(150_000);
    expect(PLAN_CATALOGUE.founder.monthlySitePriceMinor).toBe(49_900);
  });

  it("resolves annual prices with a 10% discount", () => {
    expect(ANNUAL_DISCOUNT_PERCENT).toBe(10);
    expect(annualSitePriceMinor(49_900)).toBe(538_920);
    expect(annualSitePriceMinor(99_900)).toBe(1_078_920);
    expect(resolveListedPriceMinor("essentials", "annual")).toBe(538_920);
    expect(resolveListedPriceMinor("professional", "annual")).toBe(1_078_920);
  });

  it("does not offer Enterprise as public Checkout", () => {
    expect(PLAN_CATALOGUE.enterprise.contactSales).toBe(true);
    expect(PLAN_CATALOGUE.enterprise.selfService).toBe(false);
    expect(isCheckoutPlan("enterprise")).toBe(false);
    expect(isSelfServicePlan("enterprise")).toBe(false);
  });

  it("keeps Founder private with Professional entitlements", () => {
    expect(PLAN_CATALOGUE.founder.public).toBe(false);
    expect(listPublicPlans().map((plan) => plan.code)).toEqual([
      "essentials",
      "professional",
      "enterprise",
    ]);
    expect(PLAN_CATALOGUE.founder.entitlements).toEqual(
      PLAN_CATALOGUE.professional.entitlements,
    );
    expect(PLAN_CATALOGUE.founder.setupFeeMinor).toBe(0);
  });

  it("records setup fees without collecting them in Checkout", () => {
    expect(PLAN_CATALOGUE.essentials.setupFeeMinor).toBe(150_000);
    expect(PLAN_CATALOGUE.professional.setupFeeMinor).toBe(250_000);
    expect(PLAN_CATALOGUE.essentials.setupFeeCollectedInCheckout).toBe(false);
    expect(PLAN_CATALOGUE.professional.setupFeeCollectedInCheckout).toBe(false);
  });

  it("maps plan and interval to Stripe Price environment keys", () => {
    expect(stripePriceEnvKey("professional", "monthly")).toBe(
      "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    );
    expect(stripePriceEnvKey("essentials", "annual")).toBe(
      "STRIPE_PRICE_ESSENTIALS_ANNUAL",
    );
  });

  it("keeps self-service site quantity bounds at 1 to 500", () => {
    expect(MIN_SITE_QUANTITY).toBe(1);
    expect(MAX_SITE_QUANTITY).toBe(500);
  });
});
