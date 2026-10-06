import "server-only";

import Stripe from "stripe";

import {
  isBillingInterval,
  isCheckoutPlanCode,
  isPlanCode,
  normaliseBillingState,
  unixSecondsToIso,
} from "./billing-state";
import { MIN_SITE_QUANTITY } from "./catalogue";
import { getBillingEnvironment, requireStripePriceId } from "./env";
import { BillingProviderError, type BillingProvider } from "./provider";
import {
  SITE_QUANTITY_INCREASE_PRORATION_BEHAVIOR,
  assertProviderSubscriptionBinding,
  parseDesiredSiteQuantity,
  selectLehSubscriptionItem,
} from "./site-capacity-increase";
import type {
  CheckoutPlanCode,
  ProviderSubscription,
  SubscriptionSnapshot,
  VerifiedWebhookEvent,
} from "./types";

function stripeClient(secretKey: string) {
  return new Stripe(secretKey, {
    appInfo: {
      name: "Lean Excellence Hub",
      url: "https://github.com/Shamsham01/lean-excellence-hub",
    },
  });
}

function metadataString(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    currentPeriodStart: unixSecondsToIso(item?.current_period_start),
    currentPeriodEnd: unixSecondsToIso(item?.current_period_end),
    siteQuantity: Math.max(MIN_SITE_QUANTITY, item?.quantity ?? 1),
    priceId:
      typeof item?.price?.id === "string"
        ? item.price.id
        : typeof item?.plan?.id === "string"
          ? item.plan.id
          : null,
  };
}

function customerIdOf(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function toProviderSubscription(
  subscription: Stripe.Subscription,
): ProviderSubscription {
  const period = subscriptionPeriod(subscription);
  const planCode = metadataString(subscription.metadata, "plan_code");
  const interval = metadataString(subscription.metadata, "billing_interval");
  return {
    subscriptionId: subscription.id,
    customerId: customerIdOf(subscription.customer) ?? "",
    status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart: period.currentPeriodStart,
    currentPeriodEnd: period.currentPeriodEnd,
    siteQuantity: period.siteQuantity,
    priceId: period.priceId,
    planCode: isPlanCode(planCode) ? planCode : null,
    billingInterval: isBillingInterval(interval) ? interval : null,
    organisationId: metadataString(subscription.metadata, "organisation_id"),
  };
}

function snapshotFromSubscription(
  organisationId: string,
  subscription: Stripe.Subscription,
  eventAt: string,
  extras: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot | null {
  const mapped = toProviderSubscription(subscription);
  if (!mapped.planCode || !mapped.billingInterval) {
    return null;
  }

  return {
    organisationId,
    provider: "stripe",
    customerId: mapped.customerId,
    subscriptionId: mapped.subscriptionId,
    planCode: mapped.planCode,
    billingInterval: mapped.billingInterval,
    siteQuantity: mapped.siteQuantity,
    priceId: mapped.priceId,
    providerStatus: mapped.status,
    billingState: normaliseBillingState({
      providerStatus: mapped.status,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      invoicePaymentFailed: extras.billingState === "past_due",
    }),
    currentPeriodStart: mapped.currentPeriodStart,
    currentPeriodEnd: mapped.currentPeriodEnd,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
    eventAt,
    ...extras,
  };
}

function mapStripeProviderError(cause: unknown, fallback: string) {
  if (cause instanceof BillingProviderError) {
    return cause;
  }

  if (cause instanceof Stripe.errors.StripeConnectionError) {
    return new BillingProviderError(
      "The billing provider did not respond in time. Refresh Billing to see whether capacity increased.",
      "misconfigured",
    );
  }

  if (cause instanceof Stripe.errors.StripeError) {
    return new BillingProviderError(
      cause.message || fallback,
      cause.statusCode === 404 ? "not_found" : "misconfigured",
    );
  }

  return new BillingProviderError(fallback, "misconfigured");
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  return customerIdOf(parentSubscription);
}

export function createStripeBillingProvider(
  environment = getBillingEnvironment(),
): BillingProvider {
  if (!environment.STRIPE_SECRET_KEY || !environment.STRIPE_WEBHOOK_SECRET) {
    throw new BillingProviderError(
      "Stripe billing is not configured.",
      "misconfigured",
    );
  }

  const stripe = stripeClient(environment.STRIPE_SECRET_KEY);
  const webhookSecret = environment.STRIPE_WEBHOOK_SECRET;

  return {
    name: "stripe",
    async createOrRetrieveCustomer(input) {
      if (input.existingCustomerId) {
        const customer = await stripe.customers.retrieve(
          input.existingCustomerId,
        );
        if (customer.deleted) {
          throw new BillingProviderError(
            "Billing customer was deleted.",
            "not_found",
          );
        }
        const boundOrganisation = metadataString(
          customer.metadata,
          "organisation_id",
        );
        if (boundOrganisation && boundOrganisation !== input.organisationId) {
          throw new BillingProviderError(
            "Billing customer does not belong to this organisation.",
            "conflict",
          );
        }
        return { customerId: customer.id };
      }

      const customer = await stripe.customers.create({
        name: input.organisationName,
        ...(input.email ? { email: input.email } : {}),
        metadata: {
          organisation_id: input.organisationId,
        },
      });
      return { customerId: customer.id };
    },
    async createCheckoutSession(input) {
      if (input.existingCheckoutSessionId) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(
            input.existingCheckoutSessionId,
          );
          if (
            existing.status === "open" &&
            existing.url &&
            metadataString(existing.metadata, "organisation_id") ===
              input.organisationId
          ) {
            return {
              sessionId: existing.id,
              url: existing.url,
              customerId: customerIdOf(existing.customer) ?? "",
              expiresAt: unixSecondsToIso(existing.expires_at),
            };
          }
        } catch {
          // Fall through and create a replacement session.
        }
      }

      const { customerId } = await this.createOrRetrieveCustomer({
        organisationId: input.organisationId,
        organisationName: input.organisationName,
        email: input.email ?? null,
        existingCustomerId: input.existingCustomerId ?? null,
      });

      const priceId = requireStripePriceId(
        input.planCode,
        input.interval,
        environment,
      );
      const quantity = Math.max(MIN_SITE_QUANTITY, input.siteQuantity);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          client_reference_id: input.organisationId,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          line_items: [{ price: priceId, quantity }],
          metadata: {
            organisation_id: input.organisationId,
            plan_code: input.planCode,
            billing_interval: input.interval,
          },
          subscription_data: {
            metadata: {
              organisation_id: input.organisationId,
              plan_code: input.planCode,
              billing_interval: input.interval,
            },
          },
        },
        {
          idempotencyKey: [
            "leh_checkout",
            input.organisationId,
            input.planCode,
            input.interval,
            String(quantity),
          ].join("_"),
        },
      );

      if (!session.url) {
        throw new BillingProviderError(
          "Stripe Checkout did not return a session URL.",
          "misconfigured",
        );
      }

      return {
        sessionId: session.id,
        url: session.url,
        customerId,
        expiresAt: unixSecondsToIso(session.expires_at),
      };
    },
    async createCustomerPortalSession(input) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
      });
      return { url: session.url };
    },
    async cancelAtPeriodEnd(subscriptionId) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return toProviderSubscription(subscription);
    },
    async reverseScheduledCancellation(subscriptionId) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      return toProviderSubscription(subscription);
    },
    async retrieveSubscription(subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return toProviderSubscription(subscription);
    },
    async increaseSubscriptionSiteQuantity(input) {
      const desiredSiteQuantity = parseDesiredSiteQuantity(
        input.desiredSiteQuantity,
      );

      let subscription: Stripe.Subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(
          input.subscriptionId,
        );
      } catch (cause) {
        throw mapStripeProviderError(
          cause,
          "Unable to retrieve the billing subscription.",
        );
      }

      assertProviderSubscriptionBinding({
        organisationId: input.organisationId,
        customerId: input.customerId,
        subscriptionOrganisationId: metadataString(
          subscription.metadata,
          "organisation_id",
        ),
        subscriptionCustomerId: customerIdOf(subscription.customer) ?? "",
      });

      const item = selectLehSubscriptionItem(subscription.items.data, {
        expectedPriceId: input.expectedPriceId ?? null,
        priceIdOf: (subscriptionItem) =>
          typeof subscriptionItem.price?.id === "string"
            ? subscriptionItem.price.id
            : typeof subscriptionItem.plan?.id === "string"
              ? subscriptionItem.plan.id
              : null,
      });

      const currentQuantity = Math.max(
        MIN_SITE_QUANTITY,
        item.quantity ?? MIN_SITE_QUANTITY,
      );
      if (currentQuantity === desiredSiteQuantity) {
        return toProviderSubscription(subscription);
      }
      if (desiredSiteQuantity < currentQuantity) {
        throw new BillingProviderError(
          "Reducing subscribed site quantity is not available in this flow.",
          "unsupported",
        );
      }

      try {
        const updated = await stripe.subscriptions.update(
          subscription.id,
          {
            items: [
              {
                id: item.id,
                quantity: desiredSiteQuantity,
              },
            ],
            proration_behavior: SITE_QUANTITY_INCREASE_PRORATION_BEHAVIOR,
          },
          {
            idempotencyKey: [
              "leh_site_qty",
              input.organisationId,
              subscription.id,
              String(desiredSiteQuantity),
            ].join("_"),
          },
        );
        return toProviderSubscription(updated);
      } catch (cause) {
        throw mapStripeProviderError(
          cause,
          "The billing provider rejected the site-capacity update.",
        );
      }
    },
    async verifyWebhook(input) {
      if (!input.signature) {
        throw new BillingProviderError(
          "Stripe webhook signature is missing.",
          "invalid_webhook",
        );
      }

      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          input.payload,
          input.signature,
          webhookSecret,
        );
      } catch {
        throw new BillingProviderError(
          "Stripe webhook signature is invalid.",
          "invalid_webhook",
        );
      }

      return mapStripeEvent(stripe, event);
    },
  };
}

async function mapStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<VerifiedWebhookEvent> {
  const createdAt = unixSecondsToIso(event.created) ?? new Date().toISOString();
  const object = event.data.object as {
    id?: string;
    client_reference_id?: string | null;
    customer?: unknown;
    metadata?: Stripe.Metadata | null;
    subscription?: unknown;
    parent?: Stripe.Invoice.Parent | null;
  };

  const organisationId =
    metadataString(object.metadata, "organisation_id") ??
    (typeof object.client_reference_id === "string"
      ? object.client_reference_id
      : null);

  let subscription: Stripe.Subscription | null = null;
  if (event.type.startsWith("customer.subscription")) {
    subscription = event.data.object as Stripe.Subscription;
  } else if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = customerIdOf(session.subscription);
    if (subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    }
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    }
  }

  const resolvedOrganisationId =
    organisationId ??
    (subscription
      ? metadataString(subscription.metadata, "organisation_id")
      : null);
  const customerId =
    customerIdOf(object.customer) ??
    (subscription ? customerIdOf(subscription.customer) : null);
  const subscriptionId = subscription?.id ?? customerIdOf(object.subscription);

  let snapshot: SubscriptionSnapshot | null = null;
  if (subscription && resolvedOrganisationId) {
    snapshot = snapshotFromSubscription(
      resolvedOrganisationId,
      subscription,
      createdAt,
      event.type === "invoice.payment_failed"
        ? { billingState: "past_due", providerStatus: "past_due" }
        : event.type === "invoice.paid"
          ? { clearGrace: true }
          : {},
    );
  }

  return {
    eventId: event.id,
    eventType: event.type,
    createdAt,
    organisationId: resolvedOrganisationId,
    customerId,
    subscriptionId,
    snapshot,
  };
}

export function assertCheckoutPlan(
  planCode: string,
  interval: string,
): asserts planCode is CheckoutPlanCode {
  if (!isCheckoutPlanCode(planCode) || !isBillingInterval(interval)) {
    throw new BillingProviderError(
      "That plan cannot be purchased through Checkout.",
      "unsupported",
    );
  }
}
