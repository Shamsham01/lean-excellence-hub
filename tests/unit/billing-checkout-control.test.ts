import { describe, expect, it } from "vitest";

import { isSelfServiceCheckoutEnabled } from "@/modules/billing/checkout-control";

describe("self-service checkout release gate", () => {
  it("defaults to disabled in production", () => {
    expect(isSelfServiceCheckoutEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("can be explicitly enabled for a future launch", () => {
    expect(
      isSelfServiceCheckoutEnabled({
        NODE_ENV: "production",
        LEH_SELF_SERVICE_CHECKOUT_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("keeps existing local development and CI checkout fixtures available", () => {
    expect(isSelfServiceCheckoutEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isSelfServiceCheckoutEnabled({ NODE_ENV: "development" })).toBe(
      true,
    );
  });

  it("can also be explicitly disabled outside production", () => {
    expect(
      isSelfServiceCheckoutEnabled({
        NODE_ENV: "development",
        LEH_SELF_SERVICE_CHECKOUT_ENABLED: "false",
      }),
    ).toBe(false);
  });
});
