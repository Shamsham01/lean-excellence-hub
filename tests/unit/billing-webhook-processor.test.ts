/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const claimBillingWebhookEvent = vi.fn();
const finishBillingWebhookEvent = vi.fn();
const applyOrganisationSubscriptionSnapshot = vi.fn();
const recordPlatformStripeMode = vi.fn();

vi.mock("@/modules/billing/repository", () => ({
  claimBillingWebhookEvent: (...args: unknown[]) =>
    claimBillingWebhookEvent(...args),
  finishBillingWebhookEvent: (...args: unknown[]) =>
    finishBillingWebhookEvent(...args),
  applyOrganisationSubscriptionSnapshot: (...args: unknown[]) =>
    applyOrganisationSubscriptionSnapshot(...args),
  recordPlatformStripeMode: (...args: unknown[]) =>
    recordPlatformStripeMode(...args),
}));

import {
  createFakeBillingProvider,
  createFakeBillingStore,
} from "@/modules/billing/fake-provider";
import { processVerifiedBillingEvent } from "@/modules/billing/webhook";

describe("billing webhook processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimBillingWebhookEvent.mockResolvedValue({
      eventId: "evt-row-1",
      shouldProcess: true,
      processingState: "processing",
    });
    finishBillingWebhookEvent.mockResolvedValue(undefined);
    applyOrganisationSubscriptionSnapshot.mockResolvedValue("applied");
    recordPlatformStripeMode.mockResolvedValue(undefined);
  });

  it("processes a new event once", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const event = provider.simulateCheckoutCompletion(checkout.sessionId);

    await expect(processVerifiedBillingEvent("fake", event)).resolves.toEqual({
      duplicate: false,
      applied: true,
    });
    expect(applyOrganisationSubscriptionSnapshot).toHaveBeenCalledTimes(1);
    expect(recordPlatformStripeMode).not.toHaveBeenCalled();
    expect(finishBillingWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ state: "processed" }),
    );
  });

  it("does not re-apply a duplicate event id", async () => {
    claimBillingWebhookEvent.mockResolvedValue({
      eventId: "evt-row-1",
      shouldProcess: false,
      processingState: "processed",
    });
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const event = provider.simulateCheckoutCompletion(checkout.sessionId);

    await expect(processVerifiedBillingEvent("fake", event)).resolves.toEqual({
      duplicate: true,
      applied: false,
    });
    expect(applyOrganisationSubscriptionSnapshot).not.toHaveBeenCalled();
  });

  it("marks out-of-order snapshots ignored instead of regressing state", async () => {
    applyOrganisationSubscriptionSnapshot.mockResolvedValue(
      "ignored_out_of_order",
    );
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);
    const stale = provider.simulateSubscriptionEvent(
      completed.subscriptionId!,
      "customer.subscription.updated",
      "2020-01-01T00:00:00.000Z",
    );

    await expect(processVerifiedBillingEvent("fake", stale)).resolves.toEqual({
      duplicate: false,
      applied: false,
    });
    expect(finishBillingWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ state: "ignored" }),
    );
  });

  it("applies a subscription-updated quantity snapshot through the webhook processor", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);
    await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });
    const updated = provider.simulateSubscriptionEvent(
      completed.subscriptionId!,
      "customer.subscription.updated",
    );

    await expect(processVerifiedBillingEvent("fake", updated)).resolves.toEqual(
      {
        duplicate: false,
        applied: true,
      },
    );
    expect(applyOrganisationSubscriptionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ siteQuantity: 2 }),
    );
  });

  it("does not re-apply a duplicate subscription-updated event", async () => {
    claimBillingWebhookEvent.mockResolvedValue({
      eventId: "evt-row-1",
      shouldProcess: false,
      processingState: "processed",
    });
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);
    const updated = provider.simulateSubscriptionEvent(
      completed.subscriptionId!,
      "customer.subscription.updated",
    );

    await expect(processVerifiedBillingEvent("fake", updated)).resolves.toEqual(
      {
        duplicate: true,
        applied: false,
      },
    );
    expect(applyOrganisationSubscriptionSnapshot).not.toHaveBeenCalled();
    expect(recordPlatformStripeMode).not.toHaveBeenCalled();
  });

  it("records Stripe livemode only for a verified Stripe event with an organisation", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const event = {
      ...provider.simulateCheckoutCompletion(checkout.sessionId),
      stripeLivemode: false,
    };

    await processVerifiedBillingEvent("stripe", event);

    expect(recordPlatformStripeMode).toHaveBeenCalledWith({
      livemode: false,
      organisationId: "11111111-1111-4111-8111-111111111111",
      providerEventId: event.eventId,
    });
  });

  it("does not record Stripe mode when the verified event has no organisation", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);
    const event = {
      ...completed,
      organisationId: null,
      snapshot: null,
      stripeLivemode: true,
    };

    await processVerifiedBillingEvent("stripe", event);

    expect(recordPlatformStripeMode).not.toHaveBeenCalled();
  });
});
