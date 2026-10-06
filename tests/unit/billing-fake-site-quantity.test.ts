/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  createFakeBillingProvider,
  createFakeBillingStore,
} from "@/modules/billing/fake-provider";

async function provisionActiveSubscription() {
  const store = createFakeBillingStore();
  const provider = createFakeBillingProvider(store);
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
  return { provider, store, completed };
}

describe("fake provider site quantity increase", () => {
  it("increases 1 to 2 without emitting a webhook by itself", async () => {
    const { provider, completed } = await provisionActiveSubscription();
    const updated = await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });

    expect(updated.siteQuantity).toBe(2);
    expect(completed.snapshot?.siteQuantity).toBe(1);
    expect(
      provider.store.subscriptions.get(completed.subscriptionId!)?.siteQuantity,
    ).toBe(2);
  });

  it("is idempotent for a duplicate desired quantity of 2", async () => {
    const { provider, completed } = await provisionActiveSubscription();
    await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });
    const duplicate = await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });
    expect(duplicate.siteQuantity).toBe(2);
  });

  it("refuses quantity reduction", async () => {
    const { provider, completed } = await provisionActiveSubscription();
    await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });
    await expect(
      provider.increaseSubscriptionSiteQuantity({
        organisationId: "11111111-1111-4111-8111-111111111111",
        subscriptionId: completed.subscriptionId!,
        customerId: completed.customerId!,
        desiredSiteQuantity: 1,
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
  });

  it("refuses a sibling organisation subscription", async () => {
    const { provider, completed } = await provisionActiveSubscription();
    await expect(
      provider.increaseSubscriptionSiteQuantity({
        organisationId: "22222222-2222-4222-8222-222222222222",
        subscriptionId: completed.subscriptionId!,
        customerId: completed.customerId!,
        desiredSiteQuantity: 2,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("keeps webhook confirmation as the snapshot source", async () => {
    const { provider, completed } = await provisionActiveSubscription();
    await provider.increaseSubscriptionSiteQuantity({
      organisationId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: completed.subscriptionId!,
      customerId: completed.customerId!,
      desiredSiteQuantity: 2,
    });
    const event = provider.simulateSubscriptionEvent(
      completed.subscriptionId!,
      "customer.subscription.updated",
    );
    expect(event.snapshot?.siteQuantity).toBe(2);
    expect(event.eventType).toBe("customer.subscription.updated");
  });
});
