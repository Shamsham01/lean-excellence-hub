import { PLAN_CATALOGUE } from "./catalogue";
import type { BillingState, OrganisationEntitlements, PlanCode } from "./types";

const NO_ACCESS_ENTITLEMENTS: OrganisationEntitlements = {
  coreModules: false,
  advancedBenefitsGovernance: false,
  advancedAnalytics: false,
  apiAccess: false,
  integrations: false,
  leanAiTier: "standard",
  leanAiMonthlyTokenAllowance: 0,
  enterpriseSso: false,
  enterpriseGovernance: false,
  crossSiteBenchmarking: false,
  advancedAuditRetention: false,
  supportTier: "standard",
};

export const OPERATIONAL_BILLING_STATES: BillingState[] = [
  "trialing",
  "active",
  "past_due",
  "cancel_at_period_end",
];

export function billingStateAllowsPlatformAccess(state: BillingState | null) {
  return state !== null && OPERATIONAL_BILLING_STATES.includes(state);
}

export function resolveOrganisationEntitlements(input: {
  planCode: PlanCode | null;
  billingState: BillingState | null;
  hasLegacyUnmeteredAccess?: boolean;
}): OrganisationEntitlements {
  if (input.hasLegacyUnmeteredAccess && input.planCode === null) {
    return PLAN_CATALOGUE.professional.entitlements;
  }

  if (
    !input.planCode ||
    !billingStateAllowsPlatformAccess(input.billingState)
  ) {
    return NO_ACCESS_ENTITLEMENTS;
  }

  return PLAN_CATALOGUE[input.planCode].entitlements;
}

export function organisationHasEntitlement(
  entitlements: OrganisationEntitlements,
  capability: keyof OrganisationEntitlements,
) {
  const value = entitlements[capability];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return value !== null;
}
