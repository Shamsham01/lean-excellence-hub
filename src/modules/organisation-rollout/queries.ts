import "server-only";

import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { loadCurrentOrganisationBilling } from "@/modules/billing/current-billing";
import { buildSiteCapacityView } from "@/modules/billing/site-capacity";
import {
  buildOrganisationGovernanceSnapshot,
  type GovernanceGrant,
  type GovernanceUnit,
  type OrganisationGovernanceSnapshot,
} from "@/modules/organisation-rollout/governance";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import {
  currentMemberCanDelegateRoles,
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function isPermissionDenied(error: { code?: string } | null) {
  return error?.code === "42501";
}

export type PublishedMaturityFramework = {
  modelId: string;
  versionId: string;
  name: string;
  versionNumber: number;
};

export type RolloutMemberOption = {
  membershipId: string;
  displayName: string;
};

export type RolloutWorkspace = {
  governance: OrganisationGovernanceSnapshot;
  members: RolloutMemberOption[];
  offers: DelegatableAccessOffer[];
  publishedFrameworks: PublishedMaturityFramework[];
  existingSiteCodes: string[];
};

export async function loadOrganisationGovernanceSnapshot(): Promise<OrganisationGovernanceSnapshot | null> {
  const supabase = await createServerSupabaseClient();
  const { data: organisation, error } = await supabase
    .from("organisations")
    .select("name, code, multi_site_intent")
    .maybeSingle();

  if (error || !organisation) {
    return null;
  }

  const [
    unitsResult,
    grantsResult,
    billing,
    canManageHierarchy,
    canManageBilling,
    canDelegateRoles,
    canInvite,
  ] = await Promise.all([
    supabase
      .from("organisation_units")
      .select("id, name, unit_type, parent_unit_id, status"),
    supabase
      .from("access_grants")
      .select("scope_type, scope_unit_id, status")
      .eq("status", "active"),
    loadCurrentOrganisationBilling(supabase),
    currentMemberHasOrganisationScopedPermission("hierarchy.manage"),
    currentMemberHasPermission("billing.manage"),
    currentMemberCanDelegateRoles(),
    currentMemberHasPermission("invitations.manage"),
  ]);

  const units: GovernanceUnit[] = (unitsResult.data ?? []).map((unit) => ({
    id: unit.id,
    name: unit.name,
    unit_type: unit.unit_type,
    parent_unit_id: unit.parent_unit_id,
    status: unit.status,
  }));

  const grants: GovernanceGrant[] | null = isPermissionDenied(
    grantsResult.error,
  )
    ? null
    : (grantsResult.data ?? []);

  const childCountBySiteId = new Map<string, number>();
  for (const unit of units) {
    if (!unit.parent_unit_id || unit.status !== "active") {
      continue;
    }
    childCountBySiteId.set(
      unit.parent_unit_id,
      (childCountBySiteId.get(unit.parent_unit_id) ?? 0) + 1,
    );
  }

  const assessmentCountBySiteId = new Map<string, number>();
  const siteIds = units
    .filter((unit) => isSiteUnitType(unit.unit_type))
    .map((unit) => unit.id);
  if (siteIds.length > 0) {
    const { data: assessments, error: assessmentError } = await supabase
      .from("maturity_assessments")
      .select("id, site_unit_id")
      .in("site_unit_id", siteIds);
    if (!isPermissionDenied(assessmentError)) {
      for (const assessment of assessments ?? []) {
        if (!assessment.site_unit_id) {
          continue;
        }
        assessmentCountBySiteId.set(
          assessment.site_unit_id,
          (assessmentCountBySiteId.get(assessment.site_unit_id) ?? 0) + 1,
        );
      }
    }
  }

  const siteCapacity = billing
    ? buildSiteCapacityView({
        activeSiteCount: billing.active_site_count,
        siteQuantity: billing.site_quantity,
        billingState: billing.billing_state,
        paidSiteLimit: billing.paid_site_limit,
        canManageBilling,
      })
    : null;

  return buildOrganisationGovernanceSnapshot({
    organisationName: organisation.name,
    organisationCode: organisation.code,
    multiSiteIntent: organisation.multi_site_intent,
    units,
    grants,
    childCountBySiteId,
    assessmentCountBySiteId:
      assessmentCountBySiteId.size > 0 ? assessmentCountBySiteId : null,
    siteCapacity,
    canManageHierarchy,
    canManageBilling,
    canDelegateRoles,
    canInvite:
      canInvite && (await currentMemberHasPermission("roles.delegate")),
  });
}

export async function loadRolloutWorkspace(): Promise<RolloutWorkspace | null> {
  const governance = await loadOrganisationGovernanceSnapshot();
  if (!governance) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const [membersResult, offersData, versionsResult, unitsResult] =
    await Promise.all([
      supabase
        .from("organisation_memberships")
        .select("id, display_name, user_id, status")
        .eq("status", "active")
        .order("display_name"),
      governance.canDelegateRoles
        ? loadDelegatableAccessOffers()
        : Promise.resolve({ offers: [] }),
      supabase
        .from("maturity_model_versions")
        .select("id, model_id, display_name, version_number, status")
        .eq("status", "published")
        .order("version_number", { ascending: false }),
      supabase.from("organisation_units").select("code"),
    ]);

  const membershipRows = membersResult.data ?? [];
  const userIds = [
    ...new Set(membershipRows.map((membership) => membership.user_id)),
  ];
  const profilesResult =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds)
      : { data: [] as Array<{ user_id: string; display_name: string | null }> };
  const profileNameByUserId = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]),
  );

  const members: RolloutMemberOption[] = membershipRows.map((membership) => {
    const displayName =
      membership.display_name?.trim() ||
      profileNameByUserId.get(membership.user_id)?.trim() ||
      "Organisation member";
    return { membershipId: membership.id, displayName };
  });

  const modelIds = [
    ...new Set((versionsResult.data ?? []).map((version) => version.model_id)),
  ];
  const modelsResult =
    modelIds.length > 0
      ? await supabase
          .from("maturity_models")
          .select("id, display_name")
          .in("id", modelIds)
      : { data: [] as Array<{ id: string; display_name: string }> };
  const modelNameById = new Map(
    (modelsResult.data ?? []).map((model) => [model.id, model.display_name]),
  );

  const publishedFrameworks: PublishedMaturityFramework[] = [];
  const seenModels = new Set<string>();
  for (const version of versionsResult.data ?? []) {
    if (seenModels.has(version.model_id)) {
      continue;
    }
    seenModels.add(version.model_id);
    publishedFrameworks.push({
      modelId: version.model_id,
      versionId: version.id,
      name:
        modelNameById.get(version.model_id) ??
        version.display_name ??
        "Maturity Framework",
      versionNumber: version.version_number,
    });
  }

  return {
    governance,
    members,
    offers: (offersData.offers ?? []) as DelegatableAccessOffer[],
    publishedFrameworks,
    existingSiteCodes: (unitsResult.data ?? []).map((unit) => unit.code),
  };
}
