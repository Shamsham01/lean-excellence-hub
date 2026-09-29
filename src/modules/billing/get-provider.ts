import "server-only";

import { getBillingEnvironment } from "./env";
import { createFakeBillingProvider } from "./fake-provider";
import type { BillingProvider } from "./provider";
import { createStripeBillingProvider } from "./stripe-provider";

type FakeProvider = ReturnType<typeof createFakeBillingProvider>;

const globalForFakeBilling = globalThis as typeof globalThis & {
  leanHubFakeBillingProvider?: FakeProvider;
};

export function getFakeBillingProvider() {
  globalForFakeBilling.leanHubFakeBillingProvider ??=
    createFakeBillingProvider();
  return globalForFakeBilling.leanHubFakeBillingProvider;
}

export function getBillingProvider(): BillingProvider {
  const environment = getBillingEnvironment();
  if (environment.BILLING_PROVIDER === "fake") {
    return getFakeBillingProvider();
  }
  return createStripeBillingProvider(environment);
}
