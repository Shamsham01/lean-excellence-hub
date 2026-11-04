import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import { billingStateAllowsPlatformAccess } from "@/modules/billing/entitlements";
import { isPlanCode } from "@/modules/billing/billing-state";
import type { BillingState, PlanCode } from "@/modules/billing/types";

export const LEANAI_FAIR_USE_STATEMENT =
  "Included at no extra charge, subject to reasonable fair use.";

/**
 * Catalogue token figures are not enforced. Keep this false until an approved
 * product policy says a plan allowance should pause LeanAI.
 */
export const LEANAI_PLAN_ALLOWANCE_ENFORCED = false;

export type LeanAiInclusionState =
  "included" | "legacy" | "unavailable" | "unknown";

export type LeanAiCustomerInclusion = {
  state: LeanAiInclusionState;
  planLabel: string;
  statement: string;
  siteNote: string;
};

const SITE_NOTE =
  "Usage is one shared organisation total. Subscribed site quantity scales the LEH subscription. It does not create a separate LeanAI limit for each site or each person.";

function planName(planCode: PlanCode) {
  return PLAN_CATALOGUE[planCode].name;
}

function isBillingState(
  value: string | null | undefined,
): value is BillingState {
  return (
    value === "pending" ||
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "cancel_at_period_end" ||
    value === "suspended" ||
    value === "ended"
  );
}

export function describeLeanAiCustomerInclusion(input: {
  planCode: string | null;
  billingState: string | null;
  organisationStatus: string | null;
  billingUnavailable?: boolean;
}): LeanAiCustomerInclusion {
  if (input.billingUnavailable) {
    return {
      state: "unknown",
      planLabel: "Subscription details unavailable",
      statement:
        "Subscription details could not be loaded. Settings saved here still apply only to this organisation. This page does not apply a plan token quota.",
      siteNote: SITE_NOTE,
    };
  }

  const planCode = isPlanCode(input.planCode) ? input.planCode : null;
  const billingState = isBillingState(input.billingState)
    ? input.billingState
    : null;
  const legacyIncluded =
    planCode === null && input.organisationStatus === "active";

  if (planCode && billingStateAllowsPlatformAccess(billingState)) {
    const name = planName(planCode);
    return {
      state: "included",
      planLabel: name,
      statement: `LeanAI is included with ${name}. ${LEANAI_FAIR_USE_STATEMENT} There is no AI overage invoice.`,
      siteNote: SITE_NOTE,
    };
  }

  if (legacyIncluded) {
    return {
      state: "legacy",
      planLabel: "Existing access",
      statement: `LeanAI is included with this organisation's existing access. ${LEANAI_FAIR_USE_STATEMENT} There is no AI overage invoice.`,
      siteNote: SITE_NOTE,
    };
  }

  return {
    state: "unavailable",
    planLabel: planCode ? planName(planCode) : "No active subscription",
    statement:
      "LeanAI interactions are unavailable until this organisation has an active LEH subscription. Other LEH workflows follow the access you already have. There is no AI overage charge.",
    siteNote: SITE_NOTE,
  };
}
