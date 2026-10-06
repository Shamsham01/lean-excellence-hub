import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RolloutGovernancePanel } from "@/components/organisation-rollout/rollout-governance-panel";
import type { OrganisationGovernanceSnapshot } from "@/modules/organisation-rollout/governance";

function snapshot(
  overrides: Partial<OrganisationGovernanceSnapshot> = {},
): OrganisationGovernanceSnapshot {
  return {
    organisationName: "Acme Foods Ltd",
    organisationCode: "acme",
    multiSiteIntent: "yes",
    multiSiteIntentStored: true,
    rolloutStateLabel: "Single-site pilot in a wider organisation",
    rolloutStateDescription: "This organisation expects further sites later.",
    activeSiteCount: 1,
    siteCapacity: {
      activeSiteCount: 1,
      subscribedLimit: 1,
      remainingSlots: 0,
      enforced: true,
      canManageBilling: true,
    },
    sites: [
      {
        id: "plymouth",
        name: "Plymouth Factory",
        unitType: "site",
        status: "active",
        consumesCapacity: true,
        leadership: "assigned",
        readiness: "operational_work_started",
      },
    ],
    canManageHierarchy: true,
    canManageBilling: true,
    canDelegateRoles: true,
    canInvite: true,
    ownerTransferAvailable: false,
    ...overrides,
  };
}

describe("RolloutGovernancePanel", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows organisation, capacity, and a single primary rollout action", () => {
    render(<RolloutGovernancePanel snapshot={snapshot()} />);
    expect(screen.getByTestId("rollout-governance-panel")).toHaveTextContent(
      "Acme Foods Ltd",
    );
    expect(screen.getByTestId("rollout-capacity-headline")).toHaveTextContent(
      "1 of 1 subscribed sites active",
    );
    expect(screen.getByTestId("roll-out-another-site")).toBeInTheDocument();
    expect(screen.getByTestId("rollout-add-capacity")).toBeInTheDocument();
    expect(screen.getByText("Plymouth Factory")).toBeInTheDocument();
    expect(
      screen.queryByText(/tenant|RPC|scope_unit_id/i),
    ).not.toBeInTheDocument();
  });

  it("explains missing hierarchy permission instead of offering create", () => {
    render(
      <RolloutGovernancePanel
        snapshot={snapshot({
          canManageHierarchy: false,
          canManageBilling: false,
        })}
      />,
    );
    expect(
      screen.queryByTestId("roll-out-another-site"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/authorised hierarchy administrator/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no sites exist", () => {
    render(
      <RolloutGovernancePanel
        snapshot={snapshot({ sites: [], activeSiteCount: 0 })}
      />,
    );
    expect(screen.getByTestId("rollout-empty")).toBeInTheDocument();
  });

  it("does not offer capacity purchase without billing permission", () => {
    render(
      <RolloutGovernancePanel
        snapshot={snapshot({
          canManageBilling: false,
        })}
      />,
    );
    expect(
      screen.queryByTestId("rollout-add-capacity"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("roll-out-another-site")).toBeInTheDocument();
  });
});
