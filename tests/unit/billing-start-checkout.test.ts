/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const loadCurrentOrganisationBillingManagement = vi.fn();
const createOrRetrieveCustomer = vi.fn();
const createCheckoutSession = vi.fn();
const ensureOrganisationBillingAccount = vi.fn();
const setOrganisationOpenCheckoutSession = vi.fn();

vi.mock("@/modules/billing/current-billing", () => ({
  loadCurrentOrganisationBillingManagement: () =>
    loadCurrentOrganisationBillingManagement(),
}));

vi.mock("@/modules/billing/get-provider", () => ({
  getBillingProvider: () => ({
    name: "fake",
    createOrRetrieveCustomer,
    createCheckoutSession,
  }),
}));

vi.mock("@/modules/billing/repository", () => ({
  ensureOrganisationBillingAccount: (input: Record<string, unknown>) =>
    ensureOrganisationBillingAccount(input),
  setOrganisationOpenCheckoutSession: (input: Record<string, unknown>) =>
    setOrganisationOpenCheckoutSession(input),
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({}),
}));

import { startOrganisationCheckout } from "@/modules/billing/start-checkout";

const organisationId = "11111111-1111-4111-8111-111111111111";

describe("startOrganisationCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadCurrentOrganisationBillingManagement.mockResolvedValue({
      organisation_id: organisationId,
      intended_site_quantity: 2,
      provider_customer_id: "cus_existing",
      open_checkout_session_id: "cs_existing",
    });
    createOrRetrieveCustomer.mockResolvedValue({ customerId: "cus_existing" });
    createCheckoutSession.mockResolvedValue({
      sessionId: "cs_new",
      url: "https://checkout.example.test/cs_new",
      expiresAt: "2026-10-05T12:00:00.000Z",
    });
    ensureOrganisationBillingAccount.mockResolvedValue("account-1");
    setOrganisationOpenCheckoutSession.mockResolvedValue(undefined);
  });

  it("refuses checkout when the caller lacks billing-management context", async () => {
    loadCurrentOrganisationBillingManagement.mockResolvedValue(null);

    await expect(
      startOrganisationCheckout({
        organisationId,
        organisationName: "Northwind",
        email: "owner@example.test",
        planCode: "professional",
        interval: "monthly",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(createOrRetrieveCustomer).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("reuses provider customer and open Checkout context for billing managers", async () => {
    await expect(
      startOrganisationCheckout({
        organisationId,
        organisationName: "Northwind",
        email: "owner@example.test",
        planCode: "professional",
        interval: "monthly",
      }),
    ).resolves.toMatchObject({
      sessionId: "cs_new",
      url: "https://checkout.example.test/cs_new",
    });

    expect(createOrRetrieveCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        existingCustomerId: "cus_existing",
      }),
    );
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        siteQuantity: 2,
        existingCheckoutSessionId: "cs_existing",
      }),
    );
  });
});
