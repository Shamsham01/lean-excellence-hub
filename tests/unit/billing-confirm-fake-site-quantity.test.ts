/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireClaims = vi.fn(async () => ({ sub: "user-1" }));
const currentCanManageBilling = vi.fn();
const loadCurrentOrganisationId = vi.fn();
const listEligibleOrganisations = vi.fn();
const loadCurrentOrganisationBillingManagement = vi.fn();
const loadCurrentOrganisationSubscriptionBinding = vi.fn();
const retrieveSubscription = vi.fn();
const processBillingWebhook = vi.fn();
const isFakeBillingEnabled = vi.fn(() => true);

vi.mock("@/modules/identity/session", () => ({
  requireClaims: () => requireClaims(),
}));

vi.mock("@/modules/billing/authority", () => ({
  currentCanManageBilling: () => currentCanManageBilling(),
}));

vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationId: () => loadCurrentOrganisationId(),
  listEligibleOrganisations: () => listEligibleOrganisations(),
}));

vi.mock("@/modules/billing/current-billing", () => ({
  loadCurrentOrganisationBillingManagement: () =>
    loadCurrentOrganisationBillingManagement(),
}));

vi.mock("@/modules/billing/repository", () => ({
  loadCurrentOrganisationSubscriptionBinding: () =>
    loadCurrentOrganisationSubscriptionBinding(),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({}),
}));

vi.mock("@/modules/billing/env", () => ({
  isFakeBillingEnabled: () => isFakeBillingEnabled(),
}));

vi.mock("@/modules/billing/get-provider", () => ({
  getFakeBillingProvider: () => ({
    name: "fake",
    retrieveSubscription,
  }),
}));

vi.mock("@/modules/billing/webhook", () => ({
  processBillingWebhook: (...args: unknown[]) => processBillingWebhook(...args),
}));

import { confirmFakeSiteQuantityIncrease } from "@/modules/billing/confirm-fake-site-quantity";

describe("confirmFakeSiteQuantityIncrease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFakeBillingEnabled.mockReturnValue(true);
    currentCanManageBilling.mockResolvedValue(true);
    loadCurrentOrganisationId.mockResolvedValue(
      "11111111-1111-4111-8111-111111111111",
    );
    listEligibleOrganisations.mockResolvedValue([
      {
        organisation_id: "11111111-1111-4111-8111-111111111111",
        organisation_status: "active",
      },
    ]);
    loadCurrentOrganisationBillingManagement.mockResolvedValue({
      organisation_id: "11111111-1111-4111-8111-111111111111",
      provider_customer_id: "cus_fake_1",
    });
    loadCurrentOrganisationSubscriptionBinding.mockResolvedValue({
      organisation_id: "11111111-1111-4111-8111-111111111111",
      provider_subscription_id: "sub_fake_1",
      plan_code: "professional",
      billing_interval: "monthly",
      site_quantity: 1,
      provider_price_id: "price_fake",
      provider_status: "active",
      cancel_at_period_end: false,
    });
    retrieveSubscription.mockResolvedValue({ siteQuantity: 2 });
    processBillingWebhook.mockResolvedValue({
      duplicate: false,
      applied: true,
    });
  });

  it("delivers a fake subscription-updated webhook through the real processor", async () => {
    await expect(confirmFakeSiteQuantityIncrease()).resolves.toEqual({
      duplicate: false,
      applied: true,
    });
    const call = processBillingWebhook.mock.calls[0]?.[0] as
      { payload: string; signature: string | null } | undefined;
    expect(call?.payload).toContain("customer.subscription.updated");
    expect(call?.signature).toBeNull();
    expect(JSON.parse(call?.payload ?? "{}")).toMatchObject({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_fake_1",
          organisation_id: "11111111-1111-4111-8111-111111111111",
        },
      },
    });
  });

  it("does not run when fake billing is disabled", async () => {
    isFakeBillingEnabled.mockReturnValue(false);
    await expect(confirmFakeSiteQuantityIncrease()).rejects.toMatchObject({
      code: "not_found",
    });
    expect(processBillingWebhook).not.toHaveBeenCalled();
  });
});
