import { describe, expect, it } from "vitest";

import {
  canAddBillableSite,
  paidSiteLimit,
  remainingBillableSiteSlots,
} from "@/modules/billing/site-capacity";

describe("site capacity", () => {
  it("enforces the paid site quantity with a minimum of one", () => {
    expect(paidSiteLimit({ siteQuantity: 1, billingState: "active" })).toBe(1);
    expect(
      canAddBillableSite({
        activeSiteCount: 1,
        siteQuantity: 1,
        billingState: "active",
      }),
    ).toBe(false);
    expect(
      remainingBillableSiteSlots({
        activeSiteCount: 0,
        siteQuantity: 1,
        billingState: "active",
      }),
    ).toBe(1);
  });

  it("does not cap organisations without a paid subscription", () => {
    expect(
      paidSiteLimit({ siteQuantity: null, billingState: null }),
    ).toBeNull();
    expect(
      canAddBillableSite({
        activeSiteCount: 12,
        siteQuantity: null,
        billingState: null,
      }),
    ).toBe(true);
  });

  it("stops enforcing after the subscription has ended", () => {
    expect(
      canAddBillableSite({
        activeSiteCount: 3,
        siteQuantity: 1,
        billingState: "ended",
      }),
    ).toBe(true);
  });
});
