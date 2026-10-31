import { describe, expect, it } from "vitest";

import { isSelfServiceCheckoutEnabled } from "@/modules/billing/checkout-control";

describe("self-service checkout release gate", () => {
  it("defaults to disabled in production", () => {
    const env = { NODE_ENV: "production" };
    expect(isSelfServiceCheckoutEnabled(env)).toBe(false);
  });

  it("can be enabled for a future production launch", () => {
    const env = {
      NODE_ENV: "production",
      LEH_SELF_SERVICE_CHECKOUT_ENABLED: "true",
    };
    expect(isSelfServiceCheckoutEnabled(env)).toBe(true);
  });

  it("allows local development and CI checkout fixtures", () => {
    const testEnvironment = { NODE_ENV: "test" };
    const developmentEnvironment = { NODE_ENV: "development" };
    expect(isSelfServiceCheckoutEnabled(testEnvironment)).toBe(true);
    expect(isSelfServiceCheckoutEnabled(developmentEnvironment)).toBe(true);
  });

  it("honours an explicit disable in development", () => {
    const env = {
      NODE_ENV: "development",
      LEH_SELF_SERVICE_CHECKOUT_ENABLED: "false",
    };
    expect(isSelfServiceCheckoutEnabled(env)).toBe(false);
  });
});
