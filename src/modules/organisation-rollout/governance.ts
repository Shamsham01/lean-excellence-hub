import type { SiteCapacityView } from "@/modules/billing/site-capacity";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";

import {
  resolveMultiSiteIntent,
  rolloutStateDescription,
  rolloutStateLabel,
  type MultiSiteIntent,
} from "./multi-site-intent";

export type SiteGovernanceStatus = "active" | "retired" | "other";

export type SiteLeadershipState = "assigned" | "not_assigned" | "unknown";

export type SiteReadinessState =
  | "operational_work_started"
  | "structure_started"
  | "ready_to_configure"
  | "unknown";

export type SiteGovernanceRow = {
  id: string;
  name: string;
  unitType: string;
  status: SiteGovernanceStatus;
  consumesCapacity: boolean;
  leadership: SiteLeadershipState;
  readiness: SiteReadinessState;
};

export type OrganisationGovernanceSnapshot = {
  organisationName: string;
  organisationCode: string | null;
  multiSiteIntent: MultiSiteIntent;
  multiSiteIntentStored: boolean;
  rolloutStateLabel: string;
  rolloutStateDescription: string;
  activeSiteCount: number;
  siteCapacity: SiteCapacityView | null;
  sites: SiteGovernanceRow[];
  canManageHierarchy: boolean;
  canManageBilling: boolean;
  canDelegateRoles: boolean;
  canInvite: boolean;
  ownerTransferAvailable: false;
};

export type GovernanceUnit = {
  id: string;
  name: string;
  unit_type: string;
  parent_unit_id: string | null;
  status: string;
};

export type GovernanceGrant = {
  scope_type: string;
  scope_unit_id: string | null;
  status: string;
};

export function siteGovernanceStatus(status: string): SiteGovernanceStatus {
  if (status === "active") {
    return "active";
  }
  if (status === "retired") {
    return "retired";
  }
  return "other";
}

export function siteLeadershipState(
  siteId: string,
  grants: readonly GovernanceGrant[] | null,
): SiteLeadershipState {
  if (grants === null) {
    return "unknown";
  }
  const hasLocal = grants.some(
    (grant) =>
      grant.status === "active" &&
      grant.scope_type === "unit_subtree" &&
      grant.scope_unit_id === siteId,
  );
  return hasLocal ? "assigned" : "not_assigned";
}

export function siteReadinessState(input: {
  childUnitCount: number | null;
  assessmentCount: number | null;
}): SiteReadinessState {
  if (input.assessmentCount === null && input.childUnitCount === null) {
    return "unknown";
  }
  if ((input.assessmentCount ?? 0) > 0) {
    return "operational_work_started";
  }
  if ((input.childUnitCount ?? 0) > 0) {
    return "structure_started";
  }
  return "ready_to_configure";
}

export function siteLeadershipLabel(state: SiteLeadershipState) {
  switch (state) {
    case "assigned":
      return "Local access assigned";
    case "not_assigned":
      return "No site-scoped manager yet";
    case "unknown":
      return "Leadership not shown";
  }
}

export function siteReadinessLabel(state: SiteReadinessState) {
  switch (state) {
    case "operational_work_started":
      return "Operational work started";
    case "structure_started":
      return "Structure started";
    case "ready_to_configure":
      return "Ready to configure";
    case "unknown":
      return "Setup not shown";
  }
}

export function buildSiteGovernanceRows(input: {
  units: readonly GovernanceUnit[];
  grants: readonly GovernanceGrant[] | null;
  childCountBySiteId: ReadonlyMap<string, number> | null;
  assessmentCountBySiteId: ReadonlyMap<string, number> | null;
}): SiteGovernanceRow[] {
  return input.units
    .filter((unit) => isSiteUnitType(unit.unit_type))
    .map((unit) => {
      const status = siteGovernanceStatus(unit.status);
      return {
        id: unit.id,
        name: unit.name,
        unitType: unit.unit_type,
        status,
        consumesCapacity: status === "active",
        leadership: siteLeadershipState(unit.id, input.grants),
        readiness: siteReadinessState({
          childUnitCount: input.childCountBySiteId?.get(unit.id) ?? null,
          assessmentCount: input.assessmentCountBySiteId?.get(unit.id) ?? null,
        }),
      };
    })
    .sort((left, right) => {
      if (left.consumesCapacity !== right.consumesCapacity) {
        return left.consumesCapacity ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

export function buildOrganisationGovernanceSnapshot(input: {
  organisationName: string;
  organisationCode: string | null;
  multiSiteIntent: string | null;
  units: readonly GovernanceUnit[];
  grants: readonly GovernanceGrant[] | null;
  childCountBySiteId: ReadonlyMap<string, number> | null;
  assessmentCountBySiteId: ReadonlyMap<string, number> | null;
  siteCapacity: SiteCapacityView | null;
  canManageHierarchy: boolean;
  canManageBilling: boolean;
  canDelegateRoles: boolean;
  canInvite: boolean;
}): OrganisationGovernanceSnapshot {
  const sites = buildSiteGovernanceRows({
    units: input.units,
    grants: input.grants,
    childCountBySiteId: input.childCountBySiteId,
    assessmentCountBySiteId: input.assessmentCountBySiteId,
  });
  const activeSiteCount = sites.filter((site) => site.consumesCapacity).length;
  const intent = resolveMultiSiteIntent(input.multiSiteIntent);

  return {
    organisationName: input.organisationName,
    organisationCode: input.organisationCode,
    multiSiteIntent: intent,
    multiSiteIntentStored: input.multiSiteIntent !== null,
    rolloutStateLabel: rolloutStateLabel(intent, activeSiteCount),
    rolloutStateDescription: rolloutStateDescription(intent, activeSiteCount),
    activeSiteCount,
    siteCapacity: input.siteCapacity,
    sites,
    canManageHierarchy: input.canManageHierarchy,
    canManageBilling: input.canManageBilling,
    canDelegateRoles: input.canDelegateRoles,
    canInvite: input.canInvite,
    ownerTransferAvailable: false,
  };
}
