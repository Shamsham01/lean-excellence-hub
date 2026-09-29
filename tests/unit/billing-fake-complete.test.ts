/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getClaims = vi.fn();
const rpc = vi.fn();
const loadCurrentOrganisationId = vi.fn();
const listEligibleOrganisations = vi.fn();
const lookupOpenCheckoutSession = vi.fn();
const processVerifiedBillingEvent = vi.fn();
const simulateCheckoutCompletion = vi.fn();
const hydrateCheckoutSession = vi.fn();
const isFakeBillingEnabled = vi.fn(() => true);

vi.mock("@/modules/billing/env", () => ({
  isFakeBillingEnabled: () => isFakeBillingEnabled(),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims },
    rpc,
  }),
}));

vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationId: () => loadCurrentOrganisationId(),
  listEligibleOrganisations: () => listEligibleOrganisations(),
}));

vi.mock("@/modules/billing/repository", () => ({
  lookupOpenCheckoutSession: (sessionId: string) =>
    lookupOpenCheckoutSession(sessionId),
}));

vi.mock("@/modules/billing/webhook", () => ({
  processVerifiedBillingEvent: (...args: unknown[]) =>
    processVerifiedBillingEvent(...args),
}));

vi.mock("@/modules/billing/get-provider", () => ({
  getFakeBillingProvider: () => ({
    simulateCheckoutCompletion,
    hydrateCheckoutSession,
  }),
}));

import { completeFakeCheckoutSession } from "@/modules/billing/complete-fake-checkout";
import { BillingProviderError } from "@/modules/billing/provider";

const ownOrganisation = {
  membership_id: "mem-1",
  organisation_code: "northwind",
  organisation_id: "11111111-1111-4111-8111-111111111111",
  organisation_name: "Northwind",
  organisation_status: "provisioning",
  onboarding_required: true,
  selected: true,
};

describe("completeFakeCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFakeBillingEnabled.mockReturnValue(true);
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
    loadCurrentOrganisationId.mockResolvedValue(
      ownOrganisation.organisation_id,
    );
    listEligibleOrganisations.mockResolvedValue([ownOrganisation]);
    rpc.mockResolvedValue({
      data: [
        {
          organisation_id: ownOrganisation.organisation_id,
          open_checkout_session_id: "cs_own",
        },
      ],
      error: null,
    });
    simulateCheckoutCompletion.mockReturnValue({
      organisationId: ownOrganisation.organisation_id,
      eventType: "checkout.session.completed",
    });
    processVerifiedBillingEvent.mockResolvedValue({
      duplicate: false,
      applied: true,
    });
  });

  it("rejects unauthenticated callers", async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    await expect(completeFakeCheckoutSession("cs_own")).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(simulateCheckoutCompletion).not.toHaveBeenCalled();
    expect(lookupOpenCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects callers without a selected organisation", async () => {
    loadCurrentOrganisationId.mockResolvedValue(null);

    await expect(completeFakeCheckoutSession("cs_own")).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(simulateCheckoutCompletion).not.toHaveBeenCalled();
  });

  it("rejects a foreign organisation Checkout session id", async () => {
    await expect(
      completeFakeCheckoutSession("cs_foreign"),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(simulateCheckoutCompletion).not.toHaveBeenCalled();
    expect(lookupOpenCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects completion when the selected organisation is not provisioning", async () => {
    listEligibleOrganisations.mockResolvedValue([
      { ...ownOrganisation, organisation_status: "active" },
    ]);

    await expect(completeFakeCheckoutSession("cs_own")).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(simulateCheckoutCompletion).not.toHaveBeenCalled();
  });

  it("rejects a persisted session that hydrates to a foreign organisation", async () => {
    simulateCheckoutCompletion.mockImplementation(() => {
      throw new BillingProviderError("missing", "not_found");
    });
    lookupOpenCheckoutSession.mockResolvedValue({
      organisation_id: "22222222-2222-4222-8222-222222222222",
      provider_customer_id: "cus_foreign",
      plan_code: "professional",
      billing_interval: "monthly",
      site_quantity: 1,
    });

    await expect(completeFakeCheckoutSession("cs_own")).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(hydrateCheckoutSession).not.toHaveBeenCalled();
    expect(processVerifiedBillingEvent).not.toHaveBeenCalled();
  });

  it("completes the selected organisation's own open Checkout session", async () => {
    await expect(
      completeFakeCheckoutSession("cs_own"),
    ).resolves.toBeUndefined();
    expect(simulateCheckoutCompletion).toHaveBeenCalledWith("cs_own");
    expect(processVerifiedBillingEvent).toHaveBeenCalledTimes(1);
  });
});
