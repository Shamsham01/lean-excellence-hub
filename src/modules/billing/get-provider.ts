import "server-only";

import { getBillingEnvironment } from "./env";
import { createFakeBillingProvider } from "./fake-provider";
import type { BillingProvider } from "./provider";
import { createStripeBillingProvider } from "./stripe-provider";

let fakeProvider: ReturnType<typeof createFakeBillingProvider> | null = null;

export function getBillingProvider(): BillingProvider {
  const environment = getBillingEnvironment();
  if (environment.BILLING_PROVIDER === "fake") {
    fakeProvider ??= createFakeBillingProvider();
    return fakeProvider;
  }
  return createStripeBillingProvider(environment);
}

export function getFakeBillingProvider() {
  fakeProvider ??= createFakeBillingProvider();
  return fakeProvider;
}
