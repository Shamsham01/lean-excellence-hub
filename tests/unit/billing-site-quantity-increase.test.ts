import { describe, expect, it } from "vitest";

import { BillingProviderError } from "@/modules/billing/provider";
import {
  evaluateSiteQuantityIncrease,
  formatSiteQuantityIncreaseReview,
  parseDesiredSiteQuantity,
  selectLehSubscriptionItem,
  SITE_QUANTITY_INCREASE_PRORATION_BEHAVIOR,
  siteQuantityIncreaseStateDecision,
} from "@/modules/billing/site-capacity-increase";

describe("site quantity increase policy", () => {
  it("allows active and trialing subscriptions only", () => {
    expect(siteQuantityIncreaseStateDecision("active", "professional")).toEqual(
      {
        action: "update",
      },
    );
    expect(siteQuantityIncreaseStateDecision("trialing", "founder")).toEqual({
      action: "update",
    });
    expect(
      siteQuantityIncreaseStateDecision("past_due", "professional"),
    ).toMatchObject({
      action: "reject",
      reason: "past_due",
    });
    expect(
      siteQuantityIncreaseStateDecision("cancel_at_period_end", "professional"),
    ).toMatchObject({
      action: "reject",
      reason: "cancel_at_period_end",
    });
    expect(
      siteQuantityIncreaseStateDecision("suspended", "professional"),
    ).toMatchObject({
      action: "reject",
      reason: "suspended",
    });
    expect(
      siteQuantityIncreaseStateDecision("ended", "professional"),
    ).toMatchObject({
      action: "reject",
      reason: "ended",
    });
    expect(
      siteQuantityIncreaseStateDecision("pending", "professional"),
    ).toMatchObject({
      action: "reject",
      reason: "pending",
    });
    expect(siteQuantityIncreaseStateDecision(null, null)).toMatchObject({
      action: "reject",
      reason: "missing_subscription",
    });
    expect(
      siteQuantityIncreaseStateDecision("active", "enterprise"),
    ).toMatchObject({
      action: "reject",
      reason: "enterprise",
    });
  });

  it("uses the absolute desired quantity and refuses reductions", () => {
    expect(
      evaluateSiteQuantityIncrease({
        desiredSiteQuantity: 2,
        providerSiteQuantity: 1,
        billingState: "active",
        planCode: "professional",
      }),
    ).toEqual({ action: "update" });
    expect(
      evaluateSiteQuantityIncrease({
        desiredSiteQuantity: 2,
        providerSiteQuantity: 2,
        billingState: "active",
        planCode: "professional",
      }),
    ).toEqual({ action: "noop" });
    expect(
      evaluateSiteQuantityIncrease({
        desiredSiteQuantity: 2,
        providerSiteQuantity: 3,
        billingState: "active",
        planCode: "professional",
      }),
    ).toMatchObject({
      action: "reject",
      reason: "reduction_not_supported",
    });
  });

  it("rejects a stale increment that would skip an already increased provider quantity", () => {
    const first = evaluateSiteQuantityIncrease({
      desiredSiteQuantity: 2,
      providerSiteQuantity: 1,
      billingState: "active",
      planCode: "professional",
    });
    const duplicate = evaluateSiteQuantityIncrease({
      desiredSiteQuantity: 2,
      providerSiteQuantity: 2,
      billingState: "active",
      planCode: "professional",
    });
    expect(first).toEqual({ action: "update" });
    expect(duplicate).toEqual({ action: "noop" });
  });

  it("parses catalogue bounds without trusting non-integers", () => {
    expect(parseDesiredSiteQuantity("2")).toBe(2);
    expect(() => parseDesiredSiteQuantity("1.5")).toThrow(BillingProviderError);
    expect(() => parseDesiredSiteQuantity("0")).toThrow(/at least 1/);
    expect(() => parseDesiredSiteQuantity("501")).toThrow(/cannot exceed 500/);
  });

  it("makes Stripe proration explicit and keeps review copy non-fabricated", () => {
    expect(SITE_QUANTITY_INCREASE_PRORATION_BEHAVIOR).toBe("create_prorations");
    expect(
      formatSiteQuantityIncreaseReview({
        currentQuantity: 1,
        desiredQuantity: 2,
      }),
    ).toContain("Increase subscribed sites from 1 to 2");
    expect(
      formatSiteQuantityIncreaseReview({
        currentQuantity: 1,
        desiredQuantity: 2,
      }),
    ).toContain("Your final charge is determined by Stripe");
    expect(
      formatSiteQuantityIncreaseReview({
        currentQuantity: 1,
        desiredQuantity: 2,
      }),
    ).not.toMatch(/£\d/);
  });

  it("selects the LEH subscription item by price without trusting a browser item id", () => {
    const selected = selectLehSubscriptionItem(
      [
        { id: "si_other", priceId: "price_other" },
        { id: "si_leh", priceId: "price_leh" },
      ],
      {
        expectedPriceId: "price_leh",
        priceIdOf: (item) => item.priceId,
      },
    );
    expect(selected.id).toBe("si_leh");
    expect(() =>
      selectLehSubscriptionItem(
        [
          { id: "si_a", priceId: "price_a" },
          { id: "si_b", priceId: "price_b" },
        ],
        {
          expectedPriceId: "price_missing",
          priceIdOf: (item) => item.priceId,
        },
      ),
    ).toThrow(/Unable to identify/);
  });
});
