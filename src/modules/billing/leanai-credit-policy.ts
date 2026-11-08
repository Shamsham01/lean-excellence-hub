import type { PlanCode } from "./types";

/**
 * Customer-facing LeanAI credits are policy defaults only until founder sign-off
 * and verified production usage review enable enforcement.
 *
 * 1 credit = £0.001 (0.1p) for simple customer maths. This is not a published
 * invoice unit and does not authorise automatic overage billing.
 */
export const LEANAI_CREDIT_GBP_VALUE_MINOR = 10; // 0.1p per credit in GBP minor units

/** Do not enable hard admission until rate cards are verified and usage reviewed. */
export const LEH_AI_CREDIT_POLICY_ENFORCED = false;

export type LeanAiCreditPolicyDefault = {
  /** Illustrative internal provider budget per subscribed site/month (GBP minor). */
  internalProviderBudgetGbpPerSiteMinor: number;
  /**
   * Candidate pooled monthly credits per **billed site** in the subscription
   * (× site quantity at org level). Not per employee and not a seat cap.
   */
  monthlyCreditAllowancePerSite: number;
  /** Historical catalogue token metadata; not enforced by start_ai_run. */
  catalogueTokenAllowanceMetadata: number;
};

const POLICY_DEFAULTS: Record<
  Exclude<PlanCode, "enterprise">,
  LeanAiCreditPolicyDefault
> = {
  essentials: {
    internalProviderBudgetGbpPerSiteMinor: 3_000,
    monthlyCreditAllowancePerSite: 30_000,
    catalogueTokenAllowanceMetadata: 500_000,
  },
  professional: {
    internalProviderBudgetGbpPerSiteMinor: 12_000,
    monthlyCreditAllowancePerSite: 120_000,
    catalogueTokenAllowanceMetadata: 2_000_000,
  },
  founder: {
    internalProviderBudgetGbpPerSiteMinor: 12_000,
    monthlyCreditAllowancePerSite: 120_000,
    catalogueTokenAllowanceMetadata: 2_000_000,
  },
};

export function resolveLeanAiCreditPolicyDefault(planCode: PlanCode | null) {
  if (planCode === "enterprise" || planCode === null) {
    return {
      internalProviderBudgetGbpPerSiteMinor: 12_000,
      monthlyCreditAllowancePerSite: 120_000,
      catalogueTokenAllowanceMetadata: null as number | null,
    };
  }
  return POLICY_DEFAULTS[planCode];
}

export function resolvePooledMonthlyCreditAllowance(input: {
  planCode: PlanCode | null;
  siteQuantity: number;
}) {
  const defaults = resolveLeanAiCreditPolicyDefault(input.planCode);
  const subscribedSites = Math.max(1, input.siteQuantity);
  return defaults.monthlyCreditAllowancePerSite * subscribedSites;
}
