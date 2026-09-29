export const PLAN_CODES = [
  "essentials",
  "professional",
  "enterprise",
  "founder",
] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_STATES = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "cancel_at_period_end",
  "suspended",
  "ended",
] as const;

export type BillingState = (typeof BILLING_STATES)[number];

export const BILLING_PROVIDERS = ["stripe", "fake"] as const;

export type BillingProviderName = (typeof BILLING_PROVIDERS)[number];

export const SELF_SERVICE_PLAN_CODES = ["essentials", "professional"] as const;

export type SelfServicePlanCode = (typeof SELF_SERVICE_PLAN_CODES)[number];

export type CheckoutPlanCode = SelfServicePlanCode | "founder";

export type LeanAiTier = "standard" | "enhanced" | "enterprise";

export type SupportTier = "standard" | "priority" | "named";

export type OrganisationEntitlements = {
  coreModules: boolean;
  advancedBenefitsGovernance: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  integrations: boolean;
  leanAiTier: LeanAiTier;
  leanAiMonthlyTokenAllowance: number | null;
  enterpriseSso: boolean;
  enterpriseGovernance: boolean;
  crossSiteBenchmarking: boolean;
  advancedAuditRetention: boolean;
  supportTier: SupportTier;
};

export type PlanCatalogueEntry = {
  code: PlanCode;
  name: string;
  public: boolean;
  selfService: boolean;
  contactSales: boolean;
  monthlyAvailable: boolean;
  annualAvailable: boolean;
  monthlySitePriceMinor: number;
  currency: "GBP";
  setupFeeMinor: number | null;
  setupFeeCollectedInCheckout: false;
  entitlements: OrganisationEntitlements;
  active: boolean;
};

export type SubscriptionSnapshot = {
  organisationId: string;
  provider: BillingProviderName;
  customerId: string | null;
  subscriptionId: string | null;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  siteQuantity: number;
  priceId: string | null;
  providerStatus: string | null;
  billingState: BillingState;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  eventAt: string | null;
  graceExpiresAt?: string | null;
  clearGrace?: boolean;
};

export type BillingCheckoutSession = {
  sessionId: string;
  url: string;
  customerId: string;
  expiresAt: string | null;
};

export type CustomerPortalSession = {
  url: string;
};

export type ProviderSubscription = {
  subscriptionId: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  siteQuantity: number;
  priceId: string | null;
  planCode: PlanCode | null;
  billingInterval: BillingInterval | null;
  organisationId: string | null;
};

export type VerifiedWebhookEvent = {
  eventId: string;
  eventType: string;
  createdAt: string;
  organisationId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  snapshot: SubscriptionSnapshot | null;
};
