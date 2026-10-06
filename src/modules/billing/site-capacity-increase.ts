import { MAX_SITE_QUANTITY, MIN_SITE_QUANTITY } from "./catalogue";
import { isCheckoutPlanCode } from "./billing-state";
import { BillingProviderError } from "./provider";
import type { BillingState } from "./types";

/**
 * Stripe proration for authorised site-quantity increases.
 * `create_prorations` is set explicitly so LEH never depends on Stripe's
 * unnoticed default. Proration invoice items are created; Stripe decides
 * when they are charged. LEH does not fabricate an immediate amount.
 */
export const SITE_QUANTITY_INCREASE_PRORATION_BEHAVIOR =
  "create_prorations" as const;

export const ADD_SITE_CAPACITY_HREF =
  "/platform/settings/billing?addCapacity=1" as const;
export const ADD_SITE_HREF = "/platform/settings/structure" as const;
export const CAPACITY_AVAILABLE_HIERARCHY_REQUIRED =
  "Capacity is available. Ask an authorised hierarchy administrator to create the site." as const;

export const SITE_QUANTITY_INCREASE_ALLOWED_STATES: BillingState[] = [
  "active",
  "trialing",
];

export type SiteQuantityIncreaseBlockReason =
  | "missing_subscription"
  | "pending"
  | "past_due"
  | "cancel_at_period_end"
  | "suspended"
  | "ended"
  | "enterprise"
  | "reduction_not_supported"
  | "already_at_or_above"
  | "below_minimum"
  | "above_maximum";

export type SiteQuantityIncreaseDecision =
  | { action: "update" }
  | { action: "noop" }
  | {
      action: "reject";
      reason: SiteQuantityIncreaseBlockReason;
      message: string;
    };

export type SiteQuantityIncreaseClaim = {
  action: "update" | "noop" | "reject";
  reason: "superseded" | "already_at_or_above" | "missing_subscription" | null;
  highestRequestedSiteQuantity: number | null;
  persistedSiteQuantity: number | null;
  message: string | null;
};

export function parseSiteQuantityIncreaseClaim(
  value: unknown,
): SiteQuantityIncreaseClaim {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const action =
    record.action === "update" ||
    record.action === "noop" ||
    record.action === "reject"
      ? record.action
      : "reject";
  const reason =
    record.reason === "superseded" ||
    record.reason === "already_at_or_above" ||
    record.reason === "missing_subscription"
      ? record.reason
      : null;
  const highestRequestedSiteQuantity =
    typeof record.highest_requested_site_quantity === "number"
      ? record.highest_requested_site_quantity
      : null;
  const persistedSiteQuantity =
    typeof record.site_quantity === "number" ? record.site_quantity : null;

  return {
    action,
    reason,
    highestRequestedSiteQuantity,
    persistedSiteQuantity,
    message: typeof record.message === "string" ? record.message : null,
  };
}

/**
 * Subscription-state matrix for this increase-only slice.
 *
 * | LEH state              | Increase | Behaviour |
 * |------------------------|----------|-----------|
 * | active                 | yes      | Update provider quantity to the absolute desired total |
 * | trialing               | yes      | Same as active |
 * | pending                | no       | Fail closed until the subscription is established |
 * | past_due               | no       | Resolve outstanding payment first |
 * | cancel_at_period_end   | no       | Reverse scheduled cancellation first; do not silently keep the subscription |
 * | suspended              | no       | Fail closed |
 * | ended                  | no       | Fail closed |
 * | missing subscription   | no       | Fail closed |
 * | enterprise plan        | no       | Contact-sales; not this self-service flow |
 */
export function siteQuantityIncreaseBlockMessage(
  reason: SiteQuantityIncreaseBlockReason,
): string {
  switch (reason) {
    case "missing_subscription":
      return "This organisation does not have a billing subscription to increase.";
    case "pending":
      return "Site capacity can be increased after billing has confirmed the subscription.";
    case "past_due":
      return "Resolve the outstanding payment before increasing site capacity.";
    case "cancel_at_period_end":
      return "Reverse the scheduled cancellation in Manage billing before increasing site capacity.";
    case "suspended":
      return "A suspended organisation cannot increase site capacity through this flow.";
    case "ended":
      return "An ended subscription cannot increase site capacity through this flow.";
    case "enterprise":
      return "Enterprise site capacity is changed through a commercial agreement, not this self-service flow.";
    case "reduction_not_supported":
      return "Reducing subscribed site quantity is not available in this flow.";
    case "already_at_or_above":
      return "Subscribed site quantity is already at or above the requested total.";
    case "below_minimum":
      return `Subscribed site quantity must be at least ${MIN_SITE_QUANTITY}.`;
    case "above_maximum":
      return `Subscribed site quantity cannot exceed ${MAX_SITE_QUANTITY}.`;
  }
}

export function parseDesiredSiteQuantity(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isInteger(parsed)) {
    throw new BillingProviderError(
      "Desired site quantity must be a whole number.",
      "invalid_request",
    );
  }

  if (parsed < MIN_SITE_QUANTITY) {
    throw new BillingProviderError(
      siteQuantityIncreaseBlockMessage("below_minimum"),
      "invalid_request",
    );
  }

  if (parsed > MAX_SITE_QUANTITY) {
    throw new BillingProviderError(
      siteQuantityIncreaseBlockMessage("above_maximum"),
      "invalid_request",
    );
  }

  return parsed;
}

export function siteQuantityIncreaseStateDecision(
  billingState: BillingState | null,
  planCode: string | null,
): SiteQuantityIncreaseDecision {
  if (!billingState) {
    return {
      action: "reject",
      reason: "missing_subscription",
      message: siteQuantityIncreaseBlockMessage("missing_subscription"),
    };
  }

  if (planCode && !isCheckoutPlanCode(planCode)) {
    return {
      action: "reject",
      reason: "enterprise",
      message: siteQuantityIncreaseBlockMessage("enterprise"),
    };
  }

  if (SITE_QUANTITY_INCREASE_ALLOWED_STATES.includes(billingState)) {
    return { action: "update" };
  }

  const reason: SiteQuantityIncreaseBlockReason =
    billingState === "pending" ||
    billingState === "past_due" ||
    billingState === "cancel_at_period_end" ||
    billingState === "suspended" ||
    billingState === "ended"
      ? billingState
      : "missing_subscription";

  return {
    action: "reject",
    reason,
    message: siteQuantityIncreaseBlockMessage(reason),
  };
}

export function evaluateSiteQuantityIncrease(input: {
  desiredSiteQuantity: number;
  providerSiteQuantity: number;
  billingState: BillingState | null;
  planCode: string | null;
}): SiteQuantityIncreaseDecision {
  const stateDecision = siteQuantityIncreaseStateDecision(
    input.billingState,
    input.planCode,
  );
  if (stateDecision.action === "reject") {
    return stateDecision;
  }

  if (input.desiredSiteQuantity === input.providerSiteQuantity) {
    return { action: "noop" };
  }

  if (input.desiredSiteQuantity < input.providerSiteQuantity) {
    return {
      action: "reject",
      reason: "reduction_not_supported",
      message: siteQuantityIncreaseBlockMessage("reduction_not_supported"),
    };
  }

  return { action: "update" };
}

export function formatSiteQuantityIncreaseReview(input: {
  currentQuantity: number;
  desiredQuantity: number;
}) {
  return `Increase subscribed sites from ${input.currentQuantity} to ${input.desiredQuantity}. Stripe may prorate the additional site for the remainder of your billing period. Your final charge is determined by Stripe.`;
}

export function selectLehSubscriptionItem<T>(
  items: readonly T[],
  options: {
    expectedPriceId: string | null;
    priceIdOf: (item: T) => string | null;
  },
): T {
  if (items.length === 0) {
    throw new BillingProviderError(
      "The billing subscription has no items to update.",
      "not_found",
    );
  }

  if (options.expectedPriceId) {
    const matches = items.filter(
      (item) => options.priceIdOf(item) === options.expectedPriceId,
    );
    if (matches.length === 1) {
      const match = matches[0];
      if (!match) {
        throw new BillingProviderError(
          "Unable to identify the Lean Excellence Hub subscription item.",
          "conflict",
        );
      }
      return match;
    }
    if (matches.length > 1) {
      throw new BillingProviderError(
        "Unable to uniquely identify the Lean Excellence Hub subscription item.",
        "conflict",
      );
    }
  }

  if (items.length === 1) {
    const only = items[0];
    if (!only) {
      throw new BillingProviderError(
        "The billing subscription has no items to update.",
        "not_found",
      );
    }
    return only;
  }

  throw new BillingProviderError(
    "Unable to identify the Lean Excellence Hub subscription item.",
    "conflict",
  );
}

export function assertProviderSubscriptionBinding(input: {
  organisationId: string;
  customerId: string;
  subscriptionOrganisationId: string | null;
  subscriptionCustomerId: string;
}) {
  if (
    input.subscriptionOrganisationId &&
    input.subscriptionOrganisationId !== input.organisationId
  ) {
    throw new BillingProviderError(
      "Billing subscription does not belong to this organisation.",
      "conflict",
    );
  }

  if (input.subscriptionCustomerId !== input.customerId) {
    throw new BillingProviderError(
      "Billing subscription does not belong to this organisation.",
      "conflict",
    );
  }
}
