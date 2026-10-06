import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/billing/actions", () => ({
  increaseSiteCapacity: vi.fn(),
  refreshAuthoritativeSiteCapacity: vi.fn(),
  confirmFakeSiteCapacityIncrease: vi.fn(),
}));

import { AddSiteCapacityDialog } from "@/components/billing/add-site-capacity-dialog";
import { BillingSiteCapacityPanel } from "@/components/billing/billing-site-capacity-panel";
import { increaseSiteCapacity } from "@/app/billing/actions";
import { CAPACITY_AVAILABLE_HIERARCHY_REQUIRED } from "@/modules/billing/site-capacity-increase";

afterEach(() => {
  cleanup();
});

describe("billing site capacity increase UI", () => {
  it("requires an explicit confirmation before calling the provider", async () => {
    const increase = vi.mocked(increaseSiteCapacity);
    increase.mockResolvedValue({
      ok: true,
      status: "awaiting_confirmation",
      desiredSiteQuantity: 2,
      persistedSiteQuantity: 1,
      providerSiteQuantity: 2,
    });

    render(
      <AddSiteCapacityDialog
        open
        onOpenChange={vi.fn()}
        persistedSiteQuantity={1}
        remainingSlots={0}
        fakeBillingEnabled
        canIncrease
        canCreateSite
        blockedReason={null}
      />,
    );

    expect(screen.getByTestId("desired-site-quantity")).toHaveValue(2);
    fireEvent.click(screen.getByTestId("site-capacity-continue"));
    expect(screen.getByTestId("site-capacity-confirm")).toBeVisible();
    expect(increase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("site-capacity-confirm"));
    expect(increase).toHaveBeenCalledTimes(1);
    const formData = increase.mock.calls[0]?.[0] as FormData;
    expect(formData.get("desiredSiteQuantity")).toBe("2");
    expect(
      await screen.findByTestId("site-capacity-pending"),
    ).toHaveTextContent("Waiting for billing confirmation");
  });

  it("shows Add site after spare capacity exists and does not auto-create a site", () => {
    render(
      <BillingSiteCapacityPanel
        activeSiteCount={1}
        subscribedLimit={2}
        remainingSlots={1}
        enforced
        canIncrease
        canCreateSite
        blockedReason={null}
        fakeBillingEnabled
      />,
    );

    expect(
      screen.getByTestId("billing-site-capacity-headline"),
    ).toHaveTextContent("1 of 2 active");
    expect(screen.getByTestId("billing-add-site")).toHaveAttribute(
      "href",
      "/platform/settings/structure",
    );
    expect(screen.getByTestId("add-site-capacity")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /create site/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer Add site to a billing-only member", () => {
    render(
      <BillingSiteCapacityPanel
        activeSiteCount={1}
        subscribedLimit={2}
        remainingSlots={1}
        enforced
        canIncrease
        canCreateSite={false}
        blockedReason={null}
        fakeBillingEnabled
      />,
    );

    expect(screen.queryByTestId("billing-add-site")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("billing-site-capacity-hierarchy-required"),
    ).toHaveTextContent(CAPACITY_AVAILABLE_HIERARCHY_REQUIRED);
    expect(screen.getByTestId("add-site-capacity")).toBeVisible();
  });

  it("keeps Add site capacity as the exhausted primary action", () => {
    render(
      <BillingSiteCapacityPanel
        activeSiteCount={1}
        subscribedLimit={1}
        remainingSlots={0}
        enforced
        canIncrease
        canCreateSite
        blockedReason={null}
        fakeBillingEnabled
      />,
    );

    expect(screen.getByTestId("add-site-capacity")).toBeVisible();
    expect(screen.queryByTestId("billing-add-site")).not.toBeInTheDocument();
  });
});
