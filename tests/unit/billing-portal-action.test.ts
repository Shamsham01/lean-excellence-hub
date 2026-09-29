/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireClaims = vi.fn(async () => ({ sub: "user-1" }));
const loadCurrentOrganisationId = vi.fn();
const listEligibleOrganisations = vi.fn();
const currentCanManageBilling = vi.fn();
const rpc = vi.fn();
const createCustomerPortalSessionProvider = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

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

vi.mock("@/modules/billing/get-provider", () => ({
  getBillingProvider: () => ({
    createCustomerPortalSession: createCustomerPortalSessionProvider,
  }),
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

import { createCustomerPortalSession } from "@/app/billing/actions";

const suspendedOrganisation = {
  membership_id: "mem-1",
  organisation_code: "apex",
  organisation_id: "org-1",
  organisation_name: "Apex Manufacturing",
  organisation_status: "suspended",
  selected: true,
};

describe("createCustomerPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireClaims.mockResolvedValue({ sub: "user-1" });
    loadCurrentOrganisationId.mockResolvedValue("org-1");
    listEligibleOrganisations.mockResolvedValue([suspendedOrganisation]);
    currentCanManageBilling.mockResolvedValue(true);
    rpc.mockResolvedValue({
      data: [{ provider_customer_id: "cus_123" }],
      error: null,
    });
    createCustomerPortalSessionProvider.mockResolvedValue({
      url: "https://billing.example.test/session",
    });
  });

  it("refuses ordinary suspended members without billing.manage", async () => {
    currentCanManageBilling.mockResolvedValue(false);

    await expect(createCustomerPortalSession()).rejects.toThrow(
      "REDIRECT:/billing",
    );
    expect(createCustomerPortalSessionProvider).not.toHaveBeenCalled();
  });

  it("opens Customer Portal for billing-authorised members of a suspended organisation", async () => {
    await expect(createCustomerPortalSession()).rejects.toThrow(
      "REDIRECT:https://billing.example.test/session",
    );
    expect(createCustomerPortalSessionProvider).toHaveBeenCalledWith({
      customerId: "cus_123",
      returnUrl: "http://127.0.0.1:3000/billing",
    });
  });
});
