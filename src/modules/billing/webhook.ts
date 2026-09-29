import "server-only";

import { BillingProviderError, type BillingProvider } from "./provider";
import {
  applyOrganisationSubscriptionSnapshot,
  claimBillingWebhookEvent,
  finishBillingWebhookEvent,
} from "./repository";
import type { VerifiedWebhookEvent } from "./types";

const HANDLED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function processVerifiedBillingEvent(
  providerName: "stripe" | "fake",
  event: VerifiedWebhookEvent,
) {
  const claimed = await claimBillingWebhookEvent({
    provider: providerName,
    eventId: event.eventId,
    eventType: event.eventType,
    organisationId: event.organisationId,
    diagnostic: {
      customer_id: event.customerId,
      subscription_id: event.subscriptionId,
    },
  });

  if (!claimed.shouldProcess || !claimed.eventId) {
    return { duplicate: true as const, applied: false as const };
  }

  try {
    if (!HANDLED_EVENT_TYPES.has(event.eventType) || !event.snapshot) {
      await finishBillingWebhookEvent({
        eventId: claimed.eventId,
        state: "ignored",
        organisationId: event.organisationId,
      });
      return { duplicate: false as const, applied: false as const };
    }

    const result = await applyOrganisationSubscriptionSnapshot(event.snapshot);
    await finishBillingWebhookEvent({
      eventId: claimed.eventId,
      state: result === "ignored_out_of_order" ? "ignored" : "processed",
      organisationId: event.snapshot.organisationId,
    });
    return {
      duplicate: false as const,
      applied: result === "applied",
    };
  } catch (cause) {
    await finishBillingWebhookEvent({
      eventId: claimed.eventId,
      state: "failed",
      organisationId: event.organisationId,
      error: cause instanceof Error ? cause.message.slice(0, 1000) : "failed",
    });
    throw cause;
  }
}

export async function processBillingWebhook(input: {
  provider: BillingProvider;
  payload: string;
  signature: string | null;
}) {
  let event: VerifiedWebhookEvent;
  try {
    event = await input.provider.verifyWebhook({
      payload: input.payload,
      signature: input.signature,
    });
  } catch (cause) {
    if (
      cause instanceof BillingProviderError &&
      cause.code === "invalid_webhook"
    ) {
      throw cause;
    }
    throw new BillingProviderError(
      "Unable to verify the billing webhook.",
      "invalid_webhook",
    );
  }

  return processVerifiedBillingEvent(input.provider.name, event);
}
