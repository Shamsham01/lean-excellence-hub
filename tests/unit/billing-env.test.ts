/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseBillingEnvironment } from "@/modules/billing/env";

describe("billing environment", () => {
  it("defaults to the fake provider without Stripe secrets", () => {
    expect(
      parseBillingEnvironment({
        NODE_ENV: "test",
      }).BILLING_PROVIDER,
    ).toBe("fake");
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
});
