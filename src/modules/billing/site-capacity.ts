import { MIN_SITE_QUANTITY } from "./catalogue";
import type { BillingState } from "./types";

const ENFORCED_STATES: BillingState[] = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "cancel_at_period_end",
];

export function paidSiteLimit(input: {
  siteQuantity: number | null;
  billingState: BillingState | null;
}) {
  if (
    input.siteQuantity === null ||
    input.billingState === null ||
    !ENFORCED_STATES.includes(input.billingState)
  ) {
    return null;
  }

  return Math.max(MIN_SITE_QUANTITY, input.siteQuantity);
}

export function canAddBillableSite(input: {
  activeSiteCount: number;
  siteQuantity: number | null;
  billingState: BillingState | null;
}) {
  const limit = paidSiteLimit(input);
  if (limit === null) {
    return true;
  }
  return input.activeSiteCount < limit;
}

export function remainingBillableSiteSlots(input: {
  activeSiteCount: number;
  siteQuantity: number | null;
  billingState: BillingState | null;
}) {
  const limit = paidSiteLimit(input);
  if (limit === null) {
    return null;
  }
  return Math.max(0, limit - input.activeSiteCount);
}
