import { describe, expect, it } from "vitest";

import {
  buildOrganisationSetupSnapshot,
  evaluateCoreSetup,
  pickNextAction,
} from "@/modules/organisation-setup/readiness";
import type {
  SetupPermissionSnapshot,
  SetupQueryResult,
} from "@/modules/organisation-setup/types";

const basePermissions: SetupPermissionSnapshot = {
  canManageHierarchy: true,
  canManageHierarchyAtOrgScope: true,
  canManageInvitations: true,
  canReadRoles: true,
  canManageJobFunctions: true,
  canReadJobFunctions: true,
  canManageTraining: true,
  canReadTraining: true,
  canReadHierarchy: true,
  canReadMemberships: true,
  canManageProjects: true,
};

function baseQuery(
  overrides: Partial<SetupQueryResult> = {},
): SetupQueryResult {
  return {
    organisationStatus: "active",
    organisationName: "Acme Ltd",
    organisationCode: "acme",
    activeUnitCount: 0,
    activeUnitCountUnavailable: false,
    hasOrganisationOwner: true,
    ownerCheckUnavailable: false,
    activeMembershipCount: 1,
    membershipCountUnavailable: false,
    pendingInvitationCount: 0,
    pendingInvitationsUnavailable: false,
    nonOwnerGrantCount: 0,
    grantsCheckUnavailable: false,
    customRoleWithoutGrant: false,
    customRolesCheckUnavailable: false,
    activeJobFunctionCount: 0,
    jobFunctionsUnavailable: false,
    jobFunctionAssignmentCount: 0,
    jobFunctionAssignmentsUnavailable: false,
    leanConfigSignalCount: 0,
    leanConfigUnavailable: false,
    trainingCatalogCount: 0,
    trainingCatalogUnavailable: false,
    hasChildUnits: false,
    childUnitsUnavailable: false,
    ...overrides,
  };
}

describe("organisation setup readiness", () => {
  it("marks core ready when identity, owner, and unit exist", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ activeUnitCount: 1 }),
      basePermissions,
    );

    expect(snapshot.core.readyLabel).toBe("ready");
    expect(snapshot.core.allComplete).toBe(true);
  });

  it("does not mark core ready without an operational unit", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ activeUnitCount: 0 }),
      basePermissions,
    );

    expect(snapshot.core.readyLabel).toBe("in_progress");
    expect(snapshot.core.allComplete).toBe(false);
  });

  it("uses managed_by_admin when owner cannot be assessed", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ ownerCheckUnavailable: true, hasOrganisationOwner: null }),
      basePermissions,
    );

    expect(snapshot.core.readyLabel).toBe("managed_by_admin");
    expect(snapshot.core.canAssessAll).toBe(false);
  });

  it("treats pending invitations as in progress, not complete", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ pendingInvitationCount: 2 }),
      basePermissions,
    );

    const invite = snapshot.recommended.items.find(
      (i) => i.id === "invite_team",
    );
    expect(invite?.status).toBe("in_progress");
  });

  it("marks invite complete only with multiple active members", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ activeMembershipCount: 2 }),
      basePermissions,
    );

    const invite = snapshot.recommended.items.find(
      (i) => i.id === "invite_team",
    );
    expect(invite?.status).toBe("complete");
  });

  it("never auto-completes lean configuration from one signal", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ leanConfigSignalCount: 1 }),
      basePermissions,
    );

    const lean = snapshot.recommended.items.find(
      (i) => i.id === "lean_configuration",
    );
    expect(lean?.status).toBe("setup_started");
  });

  it("picks next core action when unit is missing", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ activeUnitCount: 0 }),
      basePermissions,
    );

    expect(snapshot.nextActionHref).toBe("/platform/settings/structure");
    expect(snapshot.nextActionLabel).toBe("Continue core setup");
  });

  it("does not infer administrator from active membership alone", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ hasOrganisationOwner: false, activeMembershipCount: 1 }),
      basePermissions,
    );

    const admin = snapshot.core.items.find(
      (i) => i.id === "organisation_administrator",
    );
    expect(admin?.status).toBe("not_started");
  });

  it("evaluateCoreSetup requires all assessable items complete", () => {
    const core = evaluateCoreSetup([
      {
        id: "organisation_identity",
        tier: "core",
        title: "Identity",
        description: "",
        status: "complete",
        canAssess: true,
        canPerform: false,
      },
      {
        id: "organisation_administrator",
        tier: "core",
        title: "Admin",
        description: "",
        status: "unavailable",
        canAssess: false,
        canPerform: false,
      },
      {
        id: "operational_unit",
        tier: "core",
        title: "Unit",
        description: "",
        status: "complete",
        canAssess: true,
        canPerform: true,
      },
    ]);

    expect(core.canAssessAll).toBe(false);
    expect(core.readyLabel).toBe("managed_by_admin");
  });

  it("pickNextAction prefers incomplete core with permission", () => {
    const snapshot = buildOrganisationSetupSnapshot(
      baseQuery({ activeUnitCount: 0 }),
      basePermissions,
    );
    const next = pickNextAction(snapshot.core, snapshot.recommended);
    expect(next.href).toBe("/platform/settings/structure");
  });
});
