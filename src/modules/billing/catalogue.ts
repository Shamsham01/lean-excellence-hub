import type {
  BillingInterval,
  CheckoutPlanCode,
  OrganisationEntitlements,
  PlanCatalogueEntry,
  PlanCode,
  SelfServicePlanCode,
} from "./types";

export const BILLING_CURRENCY = "GBP" as const;
export const ANNUAL_DISCOUNT_PERCENT = 10;
export const MIN_SITE_QUANTITY = 1;
export const MAX_SITE_QUANTITY = 500;

const PROFESSIONAL_ENTITLEMENTS: OrganisationEntitlements = {
  coreModules: true,
  advancedBenefitsGovernance: true,
  advancedAnalytics: true,
  apiAccess: true,
  integrations: true,
  leanAiTier: "enhanced",
  leanAiMonthlyTokenAllowance: 2_000_000,
  enterpriseSso: false,
  enterpriseGovernance: false,
  crossSiteBenchmarking: false,
  advancedAuditRetention: false,
  supportTier: "priority",
};

const ESSENTIALS_ENTITLEMENTS: OrganisationEntitlements = {
  coreModules: true,
  advancedBenefitsGovernance: false,
  advancedAnalytics: false,
  apiAccess: false,
  integrations: false,
  leanAiTier: "standard",
  leanAiMonthlyTokenAllowance: 500_000,
  enterpriseSso: false,
  enterpriseGovernance: false,
  crossSiteBenchmarking: false,
  advancedAuditRetention: false,
  supportTier: "standard",
};

const ENTERPRISE_ENTITLEMENTS: OrganisationEntitlements = {
  ...PROFESSIONAL_ENTITLEMENTS,
  leanAiTier: "enterprise",
  leanAiMonthlyTokenAllowance: null,
  enterpriseSso: false,
  enterpriseGovernance: false,
  crossSiteBenchmarking: false,
  advancedAuditRetention: false,
  supportTier: "named",
};

export const PLAN_CATALOGUE: Record<PlanCode, PlanCatalogueEntry> = {
  essentials: {
    code: "essentials",
    name: "Essentials",
    public: true,
    selfService: true,
    contactSales: false,
    monthlyAvailable: true,
    annualAvailable: true,
    monthlySitePriceMinor: 49_900,
    currency: BILLING_CURRENCY,
    setupFeeMinor: 150_000,
    setupFeeCollectedInCheckout: false,
    entitlements: ESSENTIALS_ENTITLEMENTS,
    active: true,
  },
  professional: {
    code: "professional",
    name: "Professional",
    public: true,
    selfService: true,
    contactSales: false,
    monthlyAvailable: true,
    annualAvailable: true,
    monthlySitePriceMinor: 99_900,
    currency: BILLING_CURRENCY,
    setupFeeMinor: 250_000,
    setupFeeCollectedInCheckout: false,
    entitlements: PROFESSIONAL_ENTITLEMENTS,
    active: true,
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    public: true,
    selfService: false,
    contactSales: true,
    monthlyAvailable: false,
    annualAvailable: false,
    monthlySitePriceMinor: 150_000,
    currency: BILLING_CURRENCY,
    setupFeeMinor: null,
    setupFeeCollectedInCheckout: false,
    entitlements: ENTERPRISE_ENTITLEMENTS,
    active: true,
  },
  founder: {
    code: "founder",
    name: "Founder Pilot",
    public: false,
    selfService: true,
    contactSales: false,
    monthlyAvailable: true,
    annualAvailable: true,
    monthlySitePriceMinor: 49_900,
    currency: BILLING_CURRENCY,
    setupFeeMinor: 0,
    setupFeeCollectedInCheckout: false,
    entitlements: PROFESSIONAL_ENTITLEMENTS,
    active: true,
  },
};

export function annualSitePriceMinor(monthlySitePriceMinor: number) {
  return Math.round(
    monthlySitePriceMinor * 12 * ((100 - ANNUAL_DISCOUNT_PERCENT) / 100),
  );
}

export function resolvePlan(code: PlanCode) {
  return PLAN_CATALOGUE[code];
}

export function listPublicPlans() {
  return (Object.values(PLAN_CATALOGUE) as PlanCatalogueEntry[]).filter(
    (plan) => plan.public && plan.active,
  );
}

export function isSelfServicePlan(code: PlanCode): code is SelfServicePlanCode {
  return PLAN_CATALOGUE[code]?.selfService === true && code !== "founder";
}

export function isCheckoutPlan(code: PlanCode): code is CheckoutPlanCode {
  return code !== "enterprise" && PLAN_CATALOGUE[code]?.selfService === true;
}

export function resolveListedPriceMinor(
  code: PlanCode,
  interval: BillingInterval,
) {
  const plan = PLAN_CATALOGUE[code];
  if (interval === "annual") {
    return annualSitePriceMinor(plan.monthlySitePriceMinor);
  }
  return plan.monthlySitePriceMinor;
}

export const STRIPE_PRICE_ENV_KEYS = {
  essentials: {
    monthly: "STRIPE_PRICE_ESSENTIALS_MONTHLY",
    annual: "STRIPE_PRICE_ESSENTIALS_ANNUAL",
  },
  professional: {
    monthly: "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
    annual: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  },
  founder: {
    monthly: "STRIPE_PRICE_FOUNDER_MONTHLY",
    annual: "STRIPE_PRICE_FOUNDER_ANNUAL",
  },
} as const;

export function stripePriceEnvKey(
  planCode: CheckoutPlanCode,
  interval: BillingInterval,
) {
  return STRIPE_PRICE_ENV_KEYS[planCode][interval];
}
