import "server-only";

import { listEligibleOrganisations } from "@/modules/organisations/context";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";

import type { SetupPermissionSnapshot } from "./types";

export async function loadSetupPermissions(): Promise<SetupPermissionSnapshot> {
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find((o) => o.selected)?.membership_id;

  const [
    canManageHierarchy,
    canManageHierarchyAtOrgScope,
    canManageInvitations,
    canReadRoles,
    canManageJobFunctions,
    canReadJobFunctions,
    canManageTraining,
    canReadTraining,
    canReadHierarchy,
    canReadMemberships,
    canManageProjects,
  ] = await Promise.all([
    currentMemberHasPermission("hierarchy.manage"),
    currentMemberHasOrganisationScopedPermission("hierarchy.manage"),
    currentMemberHasPermission("invitations.manage"),
    currentMemberHasPermission("roles.read"),
    currentMemberHasPermission("job_functions.manage"),
    currentMemberHasPermission("job_functions.read"),
    currentMemberHasPermission("training.manage"),
    currentMemberHasPermission("training.read"),
    currentMemberHasPermission("hierarchy.read"),
    currentMemberHasPermission("memberships.read"),
    currentMemberHasPermission("projects.manage"),
  ]);

  return {
    canManageHierarchy,
    canManageHierarchyAtOrgScope,
    canManageInvitations,
    canReadRoles,
    canManageJobFunctions,
    canReadJobFunctions,
    canManageTraining,
    canReadTraining,
    canReadHierarchy,
    canReadMemberships,
    canManageProjects,
    currentMembershipAdminHref: currentMembershipId
      ? `/platform/people/${currentMembershipId}/admin`
      : null,
  };
}
