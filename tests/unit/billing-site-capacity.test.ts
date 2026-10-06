import { describe, expect, it } from "vitest";

import {
  buildSiteCapacityView,
  canAddBillableSite,
  formatBillingSiteCapacityHeadline,
  formatRemainingSiteSlots,
  formatSubscribedSitesActive,
  isSiteCapacityExhaustedError,
  paidSiteLimit,
  remainingBillableSiteSlots,
  SITE_CAPACITY_EXHAUSTED,
  siteCapacityExhaustedUserMessage,
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

  it("builds authoritative capacity copy from organisation billing state", () => {
    const exhausted = buildSiteCapacityView({
      activeSiteCount: 1,
      siteQuantity: 1,
      billingState: "active",
      paidSiteLimit: 1,
      canManageBilling: true,
    });
    expect(exhausted).toMatchObject({
      activeSiteCount: 1,
      subscribedLimit: 1,
      remainingSlots: 0,
      enforced: true,
    });
    expect(
      formatSubscribedSitesActive(
        exhausted.activeSiteCount,
        exhausted.subscribedLimit!,
      ),
    ).toBe("1 of 1 subscribed sites active");
    expect(
      formatBillingSiteCapacityHeadline(
        exhausted.activeSiteCount,
        exhausted.subscribedLimit!,
      ),
    ).toBe("1 of 1 active");
    expect(formatRemainingSiteSlots(exhausted.remainingSlots)).toBe(
      "No additional site slots available",
    );

    const remaining = buildSiteCapacityView({
      activeSiteCount: 2,
      siteQuantity: 4,
      billingState: "active",
      paidSiteLimit: 4,
      canManageBilling: false,
    });
    expect(formatSubscribedSitesActive(2, 4)).toBe(
      "2 of 4 subscribed sites active",
    );
    expect(formatRemainingSiteSlots(remaining.remainingSlots)).toBe(
      "2 additional site slots available",
    );
    expect(formatRemainingSiteSlots(1)).toBe(
      "1 additional site slot available",
    );
  });

  it("identifies the stable SITE_CAPACITY_EXHAUSTED condition", () => {
    expect(
      isSiteCapacityExhaustedError({
        code: "P0001",
        details: SITE_CAPACITY_EXHAUSTED,
        message: "site quantity is already at the paid subscription limit",
      }),
    ).toBe(true);
    expect(
      isSiteCapacityExhaustedError({
        code: "23514",
        message: "parent unit is not active in organisation",
      }),
    ).toBe(false);
    expect(siteCapacityExhaustedUserMessage(true)).toContain(
      "Add site capacity",
    );
    expect(siteCapacityExhaustedUserMessage(true)).not.toContain(
      "automatically change the Stripe subscription",
    );
    expect(siteCapacityExhaustedUserMessage(false)).toContain(
      "organisation billing administrator",
    );
  });
});
