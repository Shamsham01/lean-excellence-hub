import type {
  BillingCheckoutSession,
  BillingProviderName,
  CheckoutPlanCode,
  CustomerPortalSession,
  ProviderSubscription,
  VerifiedWebhookEvent,
} from "./types";
import type { BillingInterval } from "./types";

export type CreateOrRetrieveCustomerInput = {
  organisationId: string;
  organisationName: string;
  email?: string | null | undefined;
  existingCustomerId?: string | null | undefined;
};

export type CreateCheckoutSessionInput = {
  organisationId: string;
  organisationName: string;
  email?: string | null;
  planCode: CheckoutPlanCode;
  interval: BillingInterval;
  siteQuantity: number;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string | null;
  existingCheckoutSessionId?: string | null;
};

export type IncreaseSubscriptionSiteQuantityInput = {
  organisationId: string;
  subscriptionId: string;
  customerId: string;
  desiredSiteQuantity: number;
  expectedPriceId?: string | null;
};

export type BillingProvider = {
  readonly name: BillingProviderName;
  createOrRetrieveCustomer(
    input: CreateOrRetrieveCustomerInput,
  ): Promise<{ customerId: string }>;
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<BillingCheckoutSession>;
  createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<CustomerPortalSession>;
  cancelAtPeriodEnd(subscriptionId: string): Promise<ProviderSubscription>;
  reverseScheduledCancellation(
    subscriptionId: string,
  ): Promise<ProviderSubscription>;
  retrieveSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  increaseSubscriptionSiteQuantity(
    input: IncreaseSubscriptionSiteQuantityInput,
  ): Promise<ProviderSubscription>;
  verifyWebhook(input: {
    payload: string;
    signature: string | null;
  }): Promise<VerifiedWebhookEvent>;
};

export class BillingProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_webhook"
      | "invalid_request"
      | "not_found"
      | "unauthorized"
      | "forbidden"
      | "conflict"
      | "misconfigured"
      | "unsupported" = "misconfigured",
  ) {
    super(message);
    this.name = "BillingProviderError";
  }
}
