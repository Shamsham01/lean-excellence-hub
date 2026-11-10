import "server-only";

import { cache } from "react";

import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { buildCoreItems, evaluateCoreSetup } from "./readiness";
import {
  checkCurrentAdminPrimaryAssignment,
  checkOrganisationOwner,
  countActiveUnits,
  isPermissionDenied,
} from "./queries";
import type { SetupPermissionSnapshot, SetupQueryResult } from "./types";

const NAV_GATE_PERMISSIONS: SetupPermissionSnapshot = {
  canManageHierarchy: false,
  canManageHierarchyAtOrgScope: false,
  canManageInvitations: false,
  canReadRoles: false,
  canManageJobFunctions: false,
  canReadJobFunctions: false,
  canManageTraining: false,
  canReadTraining: false,
  canReadHierarchy: false,
  canReadMemberships: false,
  canManageProjects: false,
  canManageSkillsCatalog: false,
  canManageRecognition: false,
  canManageSchedules: false,
  currentMembershipAdminHref: null,
};

async function loadMinimalCoreSetupQueryResult(): Promise<SetupQueryResult> {
  const supabase = await createServerSupabaseClient();

  const { data: organisation, error: orgError } = await supabase
    .from("organisations")
    .select("name, status")
    .maybeSingle();

  if (orgError && !isPermissionDenied(orgError)) {
    throw orgError;
  }

  const [units, owner, adminAssignment] = await Promise.all([
    countActiveUnits(supabase),
    checkOrganisationOwner(supabase),
    checkCurrentAdminPrimaryAssignment(supabase),
  ]);

  const activeUnits = units.unavailable ? [] : units.units;
  const activeSiteCount = activeUnits.filter((unit) =>
    isSiteUnitType(unit.unit_type),
  ).length;

  return {
    organisationStatus: organisation?.status ?? null,
    organisationName: organisation?.name ?? null,
    organisationCode: null,
    firstSiteName: null,
    multiSiteIntent: null,
    activeUnitCount: units.unavailable ? null : activeUnits.length,
    activeUnitCountUnavailable: units.unavailable,
    activeSiteCount: units.unavailable ? null : activeSiteCount,
    activeSiteCountUnavailable: units.unavailable,
    hasOrganisationOwner: owner.unavailable ? null : owner.hasOwner,
    ownerCheckUnavailable: owner.unavailable,
    activeMembershipCount: null,
    membershipCountUnavailable: true,
    pendingInvitationCount: null,
    pendingInvitationsUnavailable: true,
    nonOwnerGrantCount: null,
    grantsCheckUnavailable: true,
    customRoleWithoutGrant: null,
    customRolesCheckUnavailable: true,
    activeJobFunctionCount: null,
    jobFunctionsUnavailable: true,
    jobFunctionAssignmentCount: null,
    jobFunctionAssignmentsUnavailable: true,
    leanConfigSignalCount: null,
    leanConfigUnavailable: true,
    publishedMaturityVersionCount: null,
    publishedMaturityUnavailable: true,
    maturityAssessmentCount: null,
    maturityAssessmentUnavailable: true,
    trainingCatalogCount: null,
    trainingCatalogUnavailable: true,
    activeSkillCount: null,
    activeSkillCountUnavailable: true,
    recognitionTypeCount: null,
    recognitionTypeCountUnavailable: true,
    scheduleDefinitionCount: null,
    scheduleDefinitionCountUnavailable: true,
    hasChildUnits: null,
    childUnitsUnavailable: true,
    currentAdminHasPrimaryAssignment: adminAssignment.unavailable
      ? null
      : adminAssignment.hasAssignment,
    adminAssignmentUnavailable: adminAssignment.unavailable,
  };
}

async function isCoreOrganisationSetupComplete(): Promise<boolean> {
  const data = await loadMinimalCoreSetupQueryResult();
  const core = evaluateCoreSetup(buildCoreItems(data, NAV_GATE_PERMISSIONS));
  return core.allComplete;
}

/**
 * When true, the Setup nav item should be shown for setup-capable members.
 * On load errors, defaults to showing Setup (fail open for navigation).
 */
export const shouldShowSetupInNavigation = cache(async (): Promise<boolean> => {
  try {
    const complete = await isCoreOrganisationSetupComplete();
    return !complete;
  } catch {
    return true;
  }
});
