/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireClaims = vi.fn(async () => ({ sub: "user-1" }));
const loadCurrentOrganisationId = vi.fn();
const listEligibleOrganisations = vi.fn();
const currentCanManageBilling = vi.fn();
const loadCurrentOrganisationBillingManagement = vi.fn();
const loadCurrentOrganisationSubscriptionBinding = vi.fn();
const retrieveSubscription = vi.fn();
const increaseSubscriptionSiteQuantity = vi.fn();
const hydrateSubscription = vi.fn();

vi.mock("@/modules/identity/session", () => ({
  requireClaims: () => requireClaims(),
}));

vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationId: () => loadCurrentOrganisationId(),
  listEligibleOrganisations: () => listEligibleOrganisations(),
}));

vi.mock("@/modules/billing/authority", () => ({
  currentCanManageBilling: () => currentCanManageBilling(),
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
  createServerSupabaseClient: async () => ({ from: vi.fn() }),
}));

vi.mock("@/modules/billing/get-provider", () => ({
  getBillingProvider: () => ({
    name: "fake",
    retrieveSubscription,
    increaseSubscriptionSiteQuantity,
  }),
  getFakeBillingProvider: () => ({
    hydrateSubscription,
  }),
}));

import { increaseCurrentOrganisationSiteQuantity } from "@/modules/billing/increase-site-quantity";

const organisation = {
  membership_id: "mem-1",
  organisation_code: "northwind",
  organisation_id: "11111111-1111-4111-8111-111111111111",
  organisation_name: "Northwind",
  organisation_status: "active",
  selected: true,
};

const snapshot = {
  organisation_id: organisation.organisation_id,
  provider_customer_id: "cus_fake_1",
  site_quantity: 1,
  paid_site_limit: 1,
  active_site_count: 1,
  billing_state: "active",
  plan_code: "professional",
};

const binding = {
  organisation_id: organisation.organisation_id,
  provider: "fake",
  provider_subscription_id: "sub_fake_1",
  provider_price_id: "price_fake_professional_monthly",
  site_quantity: 1,
  billing_state: "active",
  plan_code: "professional",
  billing_interval: "monthly",
  provider_status: "active",
  cancel_at_period_end: false,
};

describe("increaseCurrentOrganisationSiteQuantity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadCurrentOrganisationId.mockResolvedValue(organisation.organisation_id);
    listEligibleOrganisations.mockResolvedValue([organisation]);
    currentCanManageBilling.mockResolvedValue(true);
    loadCurrentOrganisationBillingManagement.mockResolvedValue(snapshot);
    loadCurrentOrganisationSubscriptionBinding.mockResolvedValue(binding);
    retrieveSubscription.mockResolvedValue({
      subscriptionId: "sub_fake_1",
      customerId: "cus_fake_1",
      status: "active",
      cancelAtPeriodEnd: false,
      siteQuantity: 1,
      planCode: "professional",
      billingInterval: "monthly",
      organisationId: organisation.organisation_id,
    });
    increaseSubscriptionSiteQuantity.mockResolvedValue({
      subscriptionId: "sub_fake_1",
      customerId: "cus_fake_1",
      status: "active",
      cancelAtPeriodEnd: false,
      siteQuantity: 2,
      planCode: "professional",
      organisationId: organisation.organisation_id,
    });
  });

  it("lets a billing admin request 1 → 2 without writing LEH quantity", async () => {
    const result = await increaseCurrentOrganisationSiteQuantity(2);
    expect(result).toMatchObject({
      ok: true,
      status: "awaiting_confirmation",
      desiredSiteQuantity: 2,
      persistedSiteQuantity: 1,
      providerSiteQuantity: 2,
    });
    expect(increaseSubscriptionSiteQuantity).toHaveBeenCalledWith({
      organisationId: organisation.organisation_id,
      subscriptionId: "sub_fake_1",
      customerId: "cus_fake_1",
      desiredSiteQuantity: 2,
      expectedPriceId: "price_fake_professional_monthly",
    });
  });

  it("refuses users without billing.manage, including hierarchy-only members", async () => {
    currentCanManageBilling.mockResolvedValue(false);
    const result = await increaseCurrentOrganisationSiteQuantity(2);
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(increaseSubscriptionSiteQuantity).not.toHaveBeenCalled();
  });

  it("refuses a quantity that does not exceed the current provider quantity", async () => {
    const result = await increaseCurrentOrganisationSiteQuantity(1);
    expect(result).toMatchObject({ ok: false, code: "unsupported" });
    expect(increaseSubscriptionSiteQuantity).not.toHaveBeenCalled();
  });

  it("converges a stale request when the provider is already at the desired quantity", async () => {
    retrieveSubscription.mockResolvedValue({
      subscriptionId: "sub_fake_1",
      customerId: "cus_fake_1",
      status: "active",
      cancelAtPeriodEnd: false,
      siteQuantity: 2,
      planCode: "professional",
      organisationId: organisation.organisation_id,
    });
    const result = await increaseCurrentOrganisationSiteQuantity(2);
    expect(result).toMatchObject({
      ok: true,
      status: "awaiting_confirmation",
      providerSiteQuantity: 2,
      persistedSiteQuantity: 1,
    });
    expect(increaseSubscriptionSiteQuantity).not.toHaveBeenCalled();
  });

  it("does not treat a successful provider update as LEH billing truth", async () => {
    loadCurrentOrganisationBillingManagement
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot);
    const result = await increaseCurrentOrganisationSiteQuantity(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.persistedSiteQuantity).toBe(1);
      expect(result.status).toBe("awaiting_confirmation");
    }
  });

  it("fails closed for past_due and cancel_at_period_end", async () => {
    loadCurrentOrganisationSubscriptionBinding.mockResolvedValue({
      ...binding,
      billing_state: "past_due",
    });
    await expect(
      increaseCurrentOrganisationSiteQuantity(2),
    ).resolves.toMatchObject({
      ok: false,
      code: "unsupported",
    });

    loadCurrentOrganisationSubscriptionBinding.mockResolvedValue({
      ...binding,
      billing_state: "cancel_at_period_end",
      cancel_at_period_end: true,
    });
    await expect(
      increaseCurrentOrganisationSiteQuantity(2),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/scheduled cancellation/i),
    });
    expect(increaseSubscriptionSiteQuantity).not.toHaveBeenCalled();
  });
});
