/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BillingConfigurationError,
  isFakeBillingEnabled,
  parseBillingEnvironment,
  tryGetBillingEnvironment,
} from "@/modules/billing/env";

describe("billing environment", () => {
  it("uses the fake provider only when BILLING_PROVIDER=fake is explicit", () => {
    expect(
      parseBillingEnvironment({
        BILLING_PROVIDER: "fake",
      }).BILLING_PROVIDER,
    ).toBe("fake");
  });

  it("does not default to fake when Stripe secrets are absent", () => {
    expect(() =>
      parseBillingEnvironment({
        NODE_ENV: "production",
      }),
    ).toThrow(BillingConfigurationError);
    expect(() => parseBillingEnvironment({})).toThrow(
      /Billing is unavailable: BILLING_PROVIDER must be set/,
    );
  });

  it("does not default to fake in NODE_ENV=test without an explicit provider", () => {
    expect(() =>
      parseBillingEnvironment({
        NODE_ENV: "test",
      }),
    ).toThrow(/Billing is unavailable/);
  });

  it("selects Stripe when BILLING_PROVIDER=stripe and Sandbox secrets are present", () => {
    expect(
      parseBillingEnvironment({
        BILLING_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_test_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
      }).BILLING_PROVIDER,
    ).toBe("stripe");
  });

  it("fails closed when Stripe is selected without secrets", () => {
    expect(() =>
      parseBillingEnvironment({
        BILLING_PROVIDER: "stripe",
      }),
    ).toThrow(/STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe/);
  });

  it("rejects live Stripe secret keys", () => {
    expect(() =>
      parseBillingEnvironment({
        BILLING_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
      }),
    ).toThrow(/Live Stripe keys are not permitted/);
  });

  it("reports billing unavailable instead of enabling fake completion", () => {
    const previous = process.env.BILLING_PROVIDER;
    const previousSecret = process.env.STRIPE_SECRET_KEY;
    delete process.env.BILLING_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;

    try {
      expect(tryGetBillingEnvironment()).toBeNull();
      expect(isFakeBillingEnabled()).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.BILLING_PROVIDER;
      } else {
        process.env.BILLING_PROVIDER = previous;
      }
      if (previousSecret === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = previousSecret;
      }
    }
  });
});
