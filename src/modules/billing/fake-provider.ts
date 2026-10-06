import { MIN_SITE_QUANTITY } from "./catalogue";
import {
  isBillingInterval,
  isCheckoutPlanCode,
  isPlanCode,
  normaliseBillingState,
  unixSecondsToIso,
} from "./billing-state";
import { BillingProviderError, type BillingProvider } from "./provider";
import {
  assertProviderSubscriptionBinding,
  parseDesiredSiteQuantity,
} from "./site-capacity-increase";
import type {
  BillingInterval,
  CheckoutPlanCode,
  PlanCode,
  ProviderSubscription,
  SubscriptionSnapshot,
  VerifiedWebhookEvent,
} from "./types";

type FakeCustomer = {
  customerId: string;
  organisationId: string;
  organisationName: string;
  email: string | null;
};

type FakeCheckout = {
  sessionId: string;
  customerId: string;
  organisationId: string;
  planCode: CheckoutPlanCode;
  interval: BillingInterval;
  siteQuantity: number;
  url: string;
  expiresAt: string;
  open: boolean;
};

type FakeSubscription = {
  subscriptionId: string;
  customerId: string;
  organisationId: string;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  siteQuantity: number;
  priceId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: number;
  currentPeriodEnd: number;
};

export type FakeBillingStore = {
  customers: Map<string, FakeCustomer>;
  customersByOrganisation: Map<string, string>;
  checkouts: Map<string, FakeCheckout>;
  subscriptions: Map<string, FakeSubscription>;
  processedEvents: Map<string, VerifiedWebhookEvent>;
};

export function createFakeBillingStore(): FakeBillingStore {
  return {
    customers: new Map(),
    customersByOrganisation: new Map(),
    checkouts: new Map(),
    subscriptions: new Map(),
    processedEvents: new Map(),
  };
}

const defaultStore = createFakeBillingStore();

function periodWindow(now = Date.now()) {
  const start = Math.floor(now / 1000);
  return {
    currentPeriodStart: start,
    currentPeriodEnd: start + 30 * 24 * 60 * 60,
  };
}

function toProviderSubscription(
  subscription: FakeSubscription,
): ProviderSubscription {
  return {
    subscriptionId: subscription.subscriptionId,
    customerId: subscription.customerId,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodStart: unixSecondsToIso(subscription.currentPeriodStart),
    currentPeriodEnd: unixSecondsToIso(subscription.currentPeriodEnd),
    siteQuantity: subscription.siteQuantity,
    priceId: subscription.priceId,
    planCode: subscription.planCode,
    billingInterval: subscription.billingInterval,
    organisationId: subscription.organisationId,
  };
}

function snapshotFromSubscription(
  subscription: FakeSubscription,
  eventAt: string,
  extras: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot {
  return {
    organisationId: subscription.organisationId,
    provider: "fake",
    customerId: subscription.customerId,
    subscriptionId: subscription.subscriptionId,
    planCode: subscription.planCode,
    billingInterval: subscription.billingInterval,
    siteQuantity: subscription.siteQuantity,
    priceId: subscription.priceId,
    providerStatus: subscription.status,
    billingState: normaliseBillingState({
      providerStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    }),
    currentPeriodStart: unixSecondsToIso(subscription.currentPeriodStart),
    currentPeriodEnd: unixSecondsToIso(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    eventAt,
    ...extras,
  };
}

export function createFakeBillingProvider(
  store: FakeBillingStore = defaultStore,
): BillingProvider & {
  store: FakeBillingStore;
  simulateCheckoutCompletion(sessionId: string): VerifiedWebhookEvent;
  hydrateCheckoutSession(input: {
    sessionId: string;
    customerId: string;
    organisationId: string;
    planCode: CheckoutPlanCode;
    interval: BillingInterval;
    siteQuantity: number;
  }): void;
  simulateSubscriptionEvent(
    subscriptionId: string,
    eventType: string,
    createdAt?: string,
  ): VerifiedWebhookEvent;
  simulateInvoiceEvent(
    subscriptionId: string,
    eventType: "invoice.paid" | "invoice.payment_failed",
    createdAt?: string,
  ): VerifiedWebhookEvent;
  hydrateSubscription(input: {
    subscriptionId: string;
    customerId: string;
    organisationId: string;
    planCode: PlanCode;
    billingInterval: BillingInterval;
    siteQuantity: number;
    priceId: string;
    status?: string;
    cancelAtPeriodEnd?: boolean;
  }): void;
} {
  return {
    name: "fake",
    store,
    async createOrRetrieveCustomer(input) {
      if (input.existingCustomerId) {
        const existing = store.customers.get(input.existingCustomerId);
        if (!existing) {
          throw new BillingProviderError(
            "Billing customer was not found.",
            "not_found",
          );
        }
        if (existing.organisationId !== input.organisationId) {
          throw new BillingProviderError(
            "Billing customer does not belong to this organisation.",
            "conflict",
          );
        }
        return { customerId: existing.customerId };
      }

      const mapped = store.customersByOrganisation.get(input.organisationId);
      if (mapped) {
        return { customerId: mapped };
      }

      const customerId = `cus_fake_${input.organisationId.replaceAll("-", "").slice(0, 16)}`;
      store.customers.set(customerId, {
        customerId,
        organisationId: input.organisationId,
        organisationName: input.organisationName,
        email: input.email ?? null,
      });
      store.customersByOrganisation.set(input.organisationId, customerId);
      return { customerId };
    },
    async createCheckoutSession(input) {
      const quantity = Math.max(MIN_SITE_QUANTITY, input.siteQuantity);
      if (input.existingCheckoutSessionId) {
        const existing = store.checkouts.get(input.existingCheckoutSessionId);
        if (
          existing?.open &&
          existing.organisationId === input.organisationId &&
          new Date(existing.expiresAt).getTime() > Date.now()
        ) {
          return {
            sessionId: existing.sessionId,
            url: existing.url,
            customerId: existing.customerId,
            expiresAt: existing.expiresAt,
          };
        }
      }

      const { customerId } = await this.createOrRetrieveCustomer({
        organisationId: input.organisationId,
        organisationName: input.organisationName,
        email: input.email ?? null,
        existingCustomerId: input.existingCustomerId ?? null,
      });

      const reuseKey = `${input.organisationId}:${input.planCode}:${input.interval}:${quantity}`;
      for (const checkout of store.checkouts.values()) {
        if (
          checkout.open &&
          checkout.organisationId === input.organisationId &&
          `${checkout.organisationId}:${checkout.planCode}:${checkout.interval}:${checkout.siteQuantity}` ===
            reuseKey &&
          new Date(checkout.expiresAt).getTime() > Date.now()
        ) {
          return {
            sessionId: checkout.sessionId,
            url: checkout.url,
            customerId: checkout.customerId,
            expiresAt: checkout.expiresAt,
          };
        }
      }

      const sessionId = `cs_fake_${store.checkouts.size + 1}_${input.organisationId.slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const session: FakeCheckout = {
        sessionId,
        customerId,
        organisationId: input.organisationId,
        planCode: input.planCode,
        interval: input.interval,
        siteQuantity: quantity,
        url: `/onboarding/confirm?session_id=${sessionId}`,
        expiresAt,
        open: true,
      };
      store.checkouts.set(sessionId, session);
      return {
        sessionId,
        url: session.url,
        customerId,
        expiresAt,
      };
    },
    async createCustomerPortalSession(input) {
      if (!store.customers.has(input.customerId)) {
        throw new BillingProviderError(
          "Billing customer was not found.",
          "not_found",
        );
      }
      return {
        url: `${input.returnUrl}?portal=fake&customer=${input.customerId}`,
      };
    },
    async cancelAtPeriodEnd(subscriptionId) {
      const subscription = store.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }
      subscription.cancelAtPeriodEnd = true;
      return toProviderSubscription(subscription);
    },
    async reverseScheduledCancellation(subscriptionId) {
      const subscription = store.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }
      subscription.cancelAtPeriodEnd = false;
      return toProviderSubscription(subscription);
    },
    async retrieveSubscription(subscriptionId) {
      const subscription = store.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }
      return toProviderSubscription(subscription);
    },
    async increaseSubscriptionSiteQuantity(input) {
      const desiredSiteQuantity = parseDesiredSiteQuantity(
        input.desiredSiteQuantity,
      );
      const subscription = store.subscriptions.get(input.subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }

      assertProviderSubscriptionBinding({
        organisationId: input.organisationId,
        customerId: input.customerId,
        subscriptionOrganisationId: subscription.organisationId,
        subscriptionCustomerId: subscription.customerId,
      });

      if (subscription.siteQuantity === desiredSiteQuantity) {
        return toProviderSubscription(subscription);
      }
      if (desiredSiteQuantity < subscription.siteQuantity) {
        throw new BillingProviderError(
          "Reducing subscribed site quantity is not available in this flow.",
          "unsupported",
        );
      }

      subscription.siteQuantity = desiredSiteQuantity;
      return toProviderSubscription(subscription);
    },
    async verifyWebhook(input) {
      if (!input.payload) {
        throw new BillingProviderError(
          "Webhook payload is empty.",
          "invalid_webhook",
        );
      }

      const parsed = JSON.parse(input.payload) as {
        id?: string;
        type?: string;
        created?: number;
        data?: { object?: Record<string, unknown> };
      };

      if (!parsed.id || !parsed.type) {
        throw new BillingProviderError(
          "Fake webhook payload is missing id or type.",
          "invalid_webhook",
        );
      }

      const object = parsed.data?.object ?? {};
      const organisationId =
        (typeof object.organisation_id === "string"
          ? object.organisation_id
          : null) ??
        (typeof (object.metadata as { organisation_id?: string } | undefined)
          ?.organisation_id === "string"
          ? (object.metadata as { organisation_id: string }).organisation_id
          : null);
      const customerId =
        typeof object.customer === "string" ? object.customer : null;
      const subscriptionId =
        typeof object.subscription === "string"
          ? object.subscription
          : typeof object.id === "string" &&
              parsed.type.startsWith("customer.subscription")
            ? object.id
            : null;

      let snapshot: SubscriptionSnapshot | null = null;
      if (subscriptionId && store.subscriptions.has(subscriptionId)) {
        snapshot = snapshotFromSubscription(
          store.subscriptions.get(subscriptionId)!,
          unixSecondsToIso(parsed.created) ?? new Date().toISOString(),
          parsed.type === "invoice.payment_failed"
            ? {
                billingState: "past_due",
                providerStatus: "past_due",
              }
            : {},
        );
      }

      return {
        eventId: parsed.id,
        eventType: parsed.type,
        createdAt: unixSecondsToIso(parsed.created) ?? new Date().toISOString(),
        organisationId,
        customerId,
        subscriptionId,
        snapshot,
      };
    },
    hydrateCheckoutSession(input) {
      const existing = store.checkouts.get(input.sessionId);
      if (existing?.open) {
        return;
      }

      store.checkouts.set(input.sessionId, {
        sessionId: input.sessionId,
        customerId: input.customerId,
        organisationId: input.organisationId,
        planCode: input.planCode,
        interval: input.interval,
        siteQuantity: Math.max(MIN_SITE_QUANTITY, input.siteQuantity),
        url: `/onboarding/confirm?session_id=${input.sessionId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        open: true,
      });
      if (!store.customers.has(input.customerId)) {
        store.customers.set(input.customerId, {
          customerId: input.customerId,
          organisationId: input.organisationId,
          organisationName: input.organisationId,
          email: null,
        });
        store.customersByOrganisation.set(
          input.organisationId,
          input.customerId,
        );
      }
    },
    hydrateSubscription(input) {
      const existing = store.subscriptions.get(input.subscriptionId);
      if (existing) {
        return;
      }

      const periods = periodWindow();
      store.subscriptions.set(input.subscriptionId, {
        subscriptionId: input.subscriptionId,
        customerId: input.customerId,
        organisationId: input.organisationId,
        planCode: input.planCode,
        billingInterval: input.billingInterval,
        siteQuantity: Math.max(MIN_SITE_QUANTITY, input.siteQuantity),
        priceId: input.priceId,
        status: input.status ?? "active",
        cancelAtPeriodEnd: input.cancelAtPeriodEnd === true,
        ...periods,
      });
      if (!store.customers.has(input.customerId)) {
        store.customers.set(input.customerId, {
          customerId: input.customerId,
          organisationId: input.organisationId,
          organisationName: input.organisationId,
          email: null,
        });
        store.customersByOrganisation.set(
          input.organisationId,
          input.customerId,
        );
      }
    },
    simulateCheckoutCompletion(sessionId) {
      const checkout = store.checkouts.get(sessionId);
      if (!checkout) {
        throw new BillingProviderError(
          "Checkout session was not found.",
          "not_found",
        );
      }
      checkout.open = false;
      const periods = periodWindow();
      const subscriptionId = `sub_fake_${sessionId}`;
      const subscription: FakeSubscription = {
        subscriptionId,
        customerId: checkout.customerId,
        organisationId: checkout.organisationId,
        planCode: checkout.planCode,
        billingInterval: checkout.interval,
        siteQuantity: checkout.siteQuantity,
        priceId: `price_fake_${checkout.planCode}_${checkout.interval}`,
        status: "active",
        cancelAtPeriodEnd: false,
        ...periods,
      };
      store.subscriptions.set(subscriptionId, subscription);
      const createdAt = unixSecondsToIso(periods.currentPeriodStart)!;
      return {
        eventId: `evt_fake_checkout_${sessionId}`,
        eventType: "checkout.session.completed",
        createdAt,
        organisationId: checkout.organisationId,
        customerId: checkout.customerId,
        subscriptionId,
        snapshot: snapshotFromSubscription(subscription, createdAt),
      };
    },
    simulateSubscriptionEvent(subscriptionId, eventType, createdAt) {
      const subscription = store.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }
      if (eventType === "customer.subscription.deleted") {
        subscription.status = "canceled";
        subscription.cancelAtPeriodEnd = false;
      }
      const eventAt = createdAt ?? new Date().toISOString();
      return {
        eventId: `evt_fake_${eventType}_${subscriptionId}_${eventAt}`,
        eventType,
        createdAt: eventAt,
        organisationId: subscription.organisationId,
        customerId: subscription.customerId,
        subscriptionId,
        snapshot: snapshotFromSubscription(subscription, eventAt),
      };
    },
    simulateInvoiceEvent(subscriptionId, eventType, createdAt) {
      const subscription = store.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new BillingProviderError(
          "Subscription was not found.",
          "not_found",
        );
      }
      if (eventType === "invoice.payment_failed") {
        subscription.status = "past_due";
      } else {
        subscription.status = "active";
      }
      const eventAt = createdAt ?? new Date().toISOString();
      return {
        eventId: `evt_fake_${eventType}_${subscriptionId}_${eventAt}`,
        eventType,
        createdAt: eventAt,
        organisationId: subscription.organisationId,
        customerId: subscription.customerId,
        subscriptionId,
        snapshot: snapshotFromSubscription(subscription, eventAt, {
          billingState:
            eventType === "invoice.payment_failed"
              ? "past_due"
              : normaliseBillingState({
                  providerStatus: subscription.status,
                  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                }),
          clearGrace: eventType === "invoice.paid",
        }),
      };
    },
  };
}

export function isCheckoutPlanMetadata(
  planCode: string | null,
  interval: string | null,
): planCode is CheckoutPlanCode {
  return isCheckoutPlanCode(planCode) && isBillingInterval(interval);
}

export function isRecognisedPlanMetadata(
  planCode: string | null,
): planCode is PlanCode {
  return isPlanCode(planCode);
}
