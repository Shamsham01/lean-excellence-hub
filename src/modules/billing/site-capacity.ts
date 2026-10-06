import { MIN_SITE_QUANTITY } from "./catalogue";
import { BILLING_STATES, type BillingState } from "./types";

export const SITE_CAPACITY_EXHAUSTED = "SITE_CAPACITY_EXHAUSTED";

const ENFORCED_STATES: BillingState[] = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "cancel_at_period_end",
];

export type SiteCapacityView = {
  activeSiteCount: number;
  subscribedLimit: number | null;
  remainingSlots: number | null;
  enforced: boolean;
  canManageBilling: boolean;
};

export function asBillingState(
  value: string | null | undefined,
): BillingState | null {
  if (!value) {
    return null;
  }
  return BILLING_STATES.includes(value as BillingState)
    ? (value as BillingState)
    : null;
}

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

export function buildSiteCapacityView(input: {
  activeSiteCount: number | null | undefined;
  siteQuantity: number | null | undefined;
  billingState: string | null | undefined;
  paidSiteLimit?: number | null | undefined;
  canManageBilling: boolean;
}): SiteCapacityView {
  const activeSiteCount =
    typeof input.activeSiteCount === "number" &&
    Number.isFinite(input.activeSiteCount)
      ? Math.max(0, input.activeSiteCount)
      : 0;
  const siteQuantity =
    typeof input.siteQuantity === "number" &&
    Number.isFinite(input.siteQuantity)
      ? input.siteQuantity
      : null;
  const billingState = asBillingState(input.billingState);
  const computedLimit = paidSiteLimit({ siteQuantity, billingState });
  const subscribedLimit =
    typeof input.paidSiteLimit === "number" &&
    Number.isFinite(input.paidSiteLimit)
      ? input.paidSiteLimit
      : computedLimit;
  const remainingSlots =
    subscribedLimit === null
      ? null
      : Math.max(0, subscribedLimit - activeSiteCount);

  return {
    activeSiteCount,
    subscribedLimit,
    remainingSlots,
    enforced: subscribedLimit !== null,
    canManageBilling: input.canManageBilling,
  };
}

export function formatSubscribedSitesActive(
  activeSiteCount: number,
  subscribedLimit: number,
) {
  return `${activeSiteCount} of ${subscribedLimit} subscribed sites active`;
}

export function formatBillingSiteCapacityHeadline(
  activeSiteCount: number,
  subscribedLimit: number,
) {
  return `${activeSiteCount} of ${subscribedLimit} active`;
}

export function formatRemainingSiteSlots(remainingSlots: number | null) {
  if (remainingSlots === null) {
    return null;
  }
  if (remainingSlots === 0) {
    return "No additional site slots available";
  }
  if (remainingSlots === 1) {
    return "1 additional site slot available";
  }
  return `${remainingSlots} additional site slots available`;
}

export function isSiteCapacityExhaustedError(error: {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}) {
  const details = error.details ?? "";
  const hint = error.hint ?? "";
  const message = error.message ?? "";
  return (
    details === SITE_CAPACITY_EXHAUSTED ||
    hint === SITE_CAPACITY_EXHAUSTED ||
    details.includes(SITE_CAPACITY_EXHAUSTED) ||
    message.includes(SITE_CAPACITY_EXHAUSTED) ||
    /site quantity is already at the paid subscription limit/i.test(message)
  );
}

export function siteCapacityExhaustedUserMessage(canManageBilling: boolean) {
  if (canManageBilling) {
    return "This organisation has used all subscribed site capacity. Open Billing to review site capacity. Lean Excellence Hub does not automatically change the Stripe subscription.";
  }
  return "This organisation has used all subscribed site capacity. Ask your organisation billing administrator to increase capacity.";
}
