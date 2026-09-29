/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  createFakeBillingProvider,
  createFakeBillingStore,
} from "@/modules/billing/fake-provider";

describe("fake billing provider", () => {
  it("reuses the customer and open Checkout session instead of duplicating them", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const first = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/onboarding/confirm",
      cancelUrl: "http://127.0.0.1:3000/onboarding/plan",
    });
    const second = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/onboarding/confirm",
      cancelUrl: "http://127.0.0.1:3000/onboarding/plan",
      existingCustomerId: first.customerId,
      existingCheckoutSessionId: first.sessionId,
    });

    expect(second.sessionId).toBe(first.sessionId);
    expect(second.customerId).toBe(first.customerId);
    expect(provider.store.customers.size).toBe(1);
  });

  it("refuses to attach a customer from another organisation", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const created = await provider.createOrRetrieveCustomer({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
    });

    await expect(
      provider.createOrRetrieveCustomer({
        organisationId: "22222222-2222-4222-8222-222222222222",
        organisationName: "Contoso",
        existingCustomerId: created.customerId,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("simulates Checkout completion without calling Stripe", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const checkout = await provider.createCheckoutSession({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
      planCode: "professional",
      interval: "monthly",
      siteQuantity: 1,
      successUrl: "http://127.0.0.1:3000/onboarding/confirm",
      cancelUrl: "http://127.0.0.1:3000/onboarding/plan",
    });

    const completed = provider.simulateCheckoutCompletion(checkout.sessionId);
    expect(completed.eventType).toBe("checkout.session.completed");
    expect(completed.snapshot?.billingState).toBe("active");
    expect(completed.snapshot?.planCode).toBe("professional");
    expect(completed.organisationId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("creates a Customer Portal session for an existing fake customer", async () => {
    const provider = createFakeBillingProvider(createFakeBillingStore());
    const created = await provider.createOrRetrieveCustomer({
      organisationId: "11111111-1111-4111-8111-111111111111",
      organisationName: "Northwind",
    });

    const portal = await provider.createCustomerPortalSession({
      customerId: created.customerId,
      returnUrl: "http://127.0.0.1:3000/billing",
    });

    expect(portal.url).toBe(
      `http://127.0.0.1:3000/billing?portal=fake&customer=${created.customerId}`,
    );
  });
});
