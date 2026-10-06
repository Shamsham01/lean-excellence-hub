/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  createFakeBillingProvider,
  createFakeBillingStore,
} from "@/modules/billing/fake-provider";

describe("billing provider boundary", () => {
  it("cannot start Checkout for a foreign organisation customer", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const own = await provider.createOrRetrieveCustomer({
      organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organisationName: "Own Org",
    });

    await expect(
      provider.createCheckoutSession({
        organisationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        organisationName: "Foreign Org",
        planCode: "professional",
        interval: "monthly",
        siteQuantity: 1,
        successUrl: "http://127.0.0.1:3000/success",
        cancelUrl: "http://127.0.0.1:3000/cancel",
        existingCustomerId: own.customerId,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("does not create a second mapping when Checkout is retried", async () => {
    const store = createFakeBillingStore();
    const provider = createFakeBillingProvider(store);
    const input = {
      organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organisationName: "Own Org",
      planCode: "professional" as const,
      interval: "monthly" as const,
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    };

    const first = await provider.createCheckoutSession(input);
    const second = await provider.createCheckoutSession({
      ...input,
      existingCustomerId: first.customerId,
      existingCheckoutSessionId: first.sessionId,
    });

    expect(second.sessionId).toBe(first.sessionId);
    expect(store.customers.size).toBe(1);
    expect(store.checkouts.size).toBe(1);
  });

  it("cannot increase another organisation's subscription quantity", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organisationName: "Own Org",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/success",
      cancelUrl: "http://127.0.0.1:3000/cancel",
    });
    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);

    await expect(
      provider.increaseSubscriptionSiteQuantity({
        organisationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        subscriptionId: completed.subscriptionId!,
        customerId: completed.customerId!,
        desiredSiteQuantity: 2,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
