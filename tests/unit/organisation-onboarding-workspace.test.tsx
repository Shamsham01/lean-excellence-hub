import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/onboarding/setup/actions", () => ({
  confirmOrganisationContext: vi.fn(),
  confirmSimpleStructure: vi.fn(),
  applyStructureDraft: vi.fn(),
  createOnboardingUnit: vi.fn(),
  updateOnboardingUnit: vi.fn(),
  createOnboardingJobFunction: vi.fn(),
  updateOnboardingJobFunction: vi.fn(),
  removeOnboardingJobFunction: vi.fn(),
  skipStructureFirstStep: vi.fn(),
  completeStructureFirstOnboarding: vi.fn(),
}));

vi.mock("@/app/(platform)/platform/settings/people/actions", () => ({
  inviteColleague: vi.fn(),
  reissueInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

import { StructureFirstProgressNav } from "@/components/onboarding/structure-first-progress";
import { StructureFirstWorkspace } from "@/components/onboarding/structure-first-workspace";
import { buildStructureFirstProgress } from "@/modules/organisation-onboarding/progress";
import type { StructureFirstSnapshotView } from "@/modules/organisation-onboarding/types";

afterEach(() => {
  cleanup();
});

const facts: StructureFirstSnapshotView["facts"] = {
  organisationName: "Acme Foods Ltd",
  organisationStatus: "active",
  organisationLocale: "en-GB",
  organisationTimeZone: "Europe/London",
  reportingCurrency: "GBP",
  billingPlanCode: "professional",
  billingPlanName: "Professional",
  firstSiteName: "Plymouth Factory",
  firstSiteId: "site-1",
  activeUnitCount: 1,
  childUnitCount: 0,
  activeJobFunctionCount: 0,
  activeMembershipCount: 1,
  pendingInvitationCount: 0,
  ownerDisplayName: "Przemyslaw Rzasa",
  onboardingJourneyStarted: false,
  events: [],
};

function snapshot(
  overrides: Partial<StructureFirstSnapshotView> = {},
): StructureFirstSnapshotView {
  const progress = buildStructureFirstProgress(facts);
  return {
    facts,
    progress,
    visibleStep: "organisation",
    units: [
      {
        id: "site-1",
        code: "plymouth",
        name: "Plymouth Factory",
        unit_type: "site",
        parent_unit_id: null,
        status: "active",
      },
    ],
    tree: [
      {
        id: "site-1",
        code: "plymouth",
        name: "Plymouth Factory",
        unitType: "site",
        parentUnitId: null,
        children: [],
      },
    ],
    jobFunctions: [],
    members: [{ membershipId: "m1", displayName: "Przemyslaw Rzasa" }],
    owners: [{ membershipId: "m1", displayName: "Przemyslaw Rzasa" }],
    pendingInvitations: [],
    permissions: {
      canManageHierarchy: true,
      canCreateRoot: true,
      canManageJobFunctions: true,
      canManageInvitations: true,
      canDelegateRoles: true,
      canAskLeanAi: false,
    },
    guidance: [],
    offers: [],
    ...overrides,
  };
}

describe("structure-first onboarding workspace", () => {
  it("shows organisation and site without recreating them", () => {
    render(<StructureFirstWorkspace snapshot={snapshot()} />);
    expect(
      screen.getByTestId("structure-first-organisation-profile"),
    ).toHaveTextContent("Acme Foods Ltd");
    expect(
      screen.getByTestId("structure-first-site-distinction"),
    ).toHaveTextContent("Plymouth Factory");
    expect(screen.getByText(/will not be recreated here/i)).toBeInTheDocument();
  });

  it("exposes skipped versus complete in the progress nav", () => {
    const progress = buildStructureFirstProgress({
      ...facts,
      onboardingJourneyStarted: true,
      events: [
        {
          eventKey: "onboarding.step_skipped",
          stepKey: "job_functions",
          occurredAt: "2026-10-05T12:00:00.000Z",
        },
      ],
    });
    render(
      <StructureFirstProgressNav progress={progress} currentStep="people" />,
    );
    expect(
      screen.getByTestId("structure-first-progress-job_functions"),
    ).toHaveAttribute("data-status", "skipped");
    expect(
      screen.getByTestId("structure-first-progress-organisation"),
    ).toHaveAttribute("data-status", "complete");
  });

  it("keeps job functions distinct from access roles", () => {
    render(
      <StructureFirstWorkspace
        snapshot={snapshot({ visibleStep: "job_functions" })}
      />,
    );
    expect(
      screen.getByTestId("structure-first-job-functions-step"),
    ).toHaveTextContent("Access roles remain separate");
  });

  it("shows the organisation owner on the people step", () => {
    render(
      <StructureFirstWorkspace
        snapshot={snapshot({ visibleStep: "people" })}
      />,
    );
    expect(
      screen.getByTestId("structure-first-people-summary"),
    ).toHaveTextContent("Przemyslaw Rzasa");
    expect(
      screen.getByTestId("structure-first-skip-people"),
    ).toBeInTheDocument();
  });
});
