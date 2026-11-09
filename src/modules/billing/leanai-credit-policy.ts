import type { PlanCode } from "./types";

/**
 * LeanAI **cost credits** are internal ledger micro-units of the organisation
 * reporting currency derived from provisional provider/model rate cards + FX-ready
 * fields in `private.leanai_provider_rate_cards`. They are NOT token counts.
 *
 * Monthly `monthlyCreditAllowancePerSite` values are pooled **cost-credit budgets**
 * per billed site (× quantity). `catalogueTokenAllowanceMetadata` is historical
 * monitoring copy only — not cost governance and not read by admission logic.
 *
 * Hard admission remains off until operator sets `credit_policy_enforced` and
 * rate cards are reviewed (cards stay `provisional=true` until then).
 */
/** 1 cost credit = £0.001 reporting-currency budget (1000 micro-GBP). Illustrative until invoicing. */
export const LEANAI_CREDIT_MICRO_GBP_PER_CREDIT = 1_000;

/** Do not enable hard admission until rate cards are verified and usage reviewed. */
export const LEH_AI_CREDIT_POLICY_ENFORCED = false;

export type LeanAiCreditPolicyDefault = {
  /** Illustrative internal provider budget per subscribed site/month (GBP minor). */
  internalProviderBudgetGbpPerSiteMinor: number;
  /** Pooled monthly **cost-credit** budget per billed site (not tokens). */
  monthlyCreditAllowancePerSite: number;
  /** Historical catalogue token metadata only (monitoring / copy). */
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
