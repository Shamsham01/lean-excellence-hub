import "server-only";

import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { isPlanCode } from "@/modules/billing/billing-state";
import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import { loadCurrentOrganisationBilling } from "@/modules/billing/current-billing";
import { assessCoachAiEligibility } from "@/modules/leanai-context/coach/eligibility";
import { loadLeanAiContextualSnapshot } from "@/modules/leanai-context/queries";
import { AI_PERMISSIONS } from "@/modules/operational/permissions";
import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import { loadPendingInvitationGrants } from "@/modules/organisation/pending-invitation-grants";
import {
  loadAccessibleOrganisationUnits,
  loadActiveSiteContext,
} from "@/modules/organisation/site-context-server";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import {
  buildOrganisationUnitTree,
  formatUnitPath,
} from "@/modules/organisation/unit-hierarchy";
import { formatLongDate } from "@/lib/dates/format-long-date";
import {
  currentMemberCanDelegateRoles,
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { buildStructureFirstGuidance } from "./guidance";
import {
  buildStructureFirstProgress,
  resolveVisibleStructureFirstStep,
} from "./progress";
import type {
  StructureFirstFacts,
  StructureFirstJobFunction,
  StructureFirstMember,
  StructureFirstOnboardingEvent,
  StructureFirstOwner,
  StructureFirstPendingInvitation,
  StructureFirstPermissions,
  StructureFirstSnapshotView,
} from "./types";

export type StructureFirstSnapshot = StructureFirstSnapshotView;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function memberDisplayName(input: {
  membershipName: string | null | undefined;
  profileName: string | null | undefined;
  isCurrentUser: boolean;
}) {
  const membershipName = input.membershipName?.trim();
  if (membershipName) {
    return membershipName;
  }
  const profileName = input.profileName?.trim();
  if (profileName) {
    return profileName;
  }
  return input.isCurrentUser ? "You" : "Organisation member";
}

function parseOnboardingEvents(
  rows: Array<{
    event_key: string;
    metadata: unknown;
    occurred_at: string;
  }>,
): StructureFirstOnboardingEvent[] {
  return rows.flatMap((row) => {
    if (
      row.event_key !== "onboarding.step_completed" &&
      row.event_key !== "onboarding.step_skipped"
    ) {
      return [];
    }
    const metadata = asRecord(row.metadata);
    const stepKey =
      typeof metadata.step_key === "string" ? metadata.step_key : "";
    if (!stepKey) {
      return [];
    }
    return [
      {
        eventKey: row.event_key,
        stepKey,
        occurredAt: row.occurred_at,
      },
    ];
  });
}

async function loadPermissions(): Promise<StructureFirstPermissions> {
  const supabase = await createServerSupabaseClient();
  const [
    canManageHierarchy,
    canCreateRoot,
    canManageJobFunctions,
    canManageInvitations,
    canDelegateRoles,
    canUseAi,
    eligibility,
    { data: aiSettings },
  ] = await Promise.all([
    currentMemberHasPermission("hierarchy.manage"),
    currentMemberHasOrganisationScopedPermission("hierarchy.manage"),
    currentMemberHasPermission("job_functions.manage"),
    currentMemberHasPermission("invitations.manage"),
    currentMemberCanDelegateRoles(),
    currentMemberHasPermission(AI_PERMISSIONS.use),
    assessCoachAiEligibility(supabase),
    supabase
      .from("organisation_ai_settings")
      .select("ai_enabled")
      .maybeSingle(),
  ]);

  return {
    canManageHierarchy,
    canCreateRoot,
    canManageJobFunctions,
    canManageInvitations,
    canDelegateRoles,
    canAskLeanAi: canUseAi && eligibility.ok && aiSettings?.ai_enabled === true,
  };
}

export async function loadStructureFirstSnapshot(
  requestedStep?: string | null,
): Promise<StructureFirstSnapshot> {
  const supabase = await createServerSupabaseClient();
  const [allUnits, { context: siteContext }] = await Promise.all([
    loadAccessibleOrganisationUnits(),
    loadActiveSiteContext(),
  ]);

  const [
    organisationResult,
    billing,
    jobFunctionsResult,
    membershipsResult,
    ownerGrantsResult,
    pendingResult,
    eventsResult,
    journeySnapshot,
    permissions,
    offersData,
    rolesResult,
    roleVersionsResult,
    claimsResult,
  ] = await Promise.all([
    supabase
      .from("organisations")
      .select(
        "name, locale, time_zone, reporting_currency, status, multi_site_intent",
      )
      .maybeSingle(),
    loadCurrentOrganisationBilling(supabase),
    supabase
      .from("job_functions")
      .select("id, name, code, description, status")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("organisation_memberships")
      .select("id, display_name, user_id, status")
      .eq("status", "active")
      .order("display_name"),
    supabase
      .from("access_grants")
      .select(
        "grantee_membership_id, status, scope_type, role_versions!inner(status, roles!inner(is_owner_role, status))",
      )
      .eq("status", "active")
      .eq("scope_type", "organisation"),
    supabase
      .from("organisation_invitations")
      .select("id, status, canonical_recipient, expires_at")
      .eq("status", "pending")
      .order("expires_at", { ascending: true }),
    supabase
      .from("leanai_semantic_events")
      .select("event_key, metadata, occurred_at")
      .in("event_key", ["onboarding.step_completed", "onboarding.step_skipped"])
      .order("occurred_at", { ascending: true }),
    loadLeanAiContextualSnapshot().catch(() => null),
    loadPermissions(),
    currentMemberCanDelegateRoles().then((canDelegate) =>
      canDelegate ? loadDelegatableAccessOffers() : { offers: [] },
    ),
    supabase.from("roles").select("id, display_name"),
    supabase
      .from("role_versions")
      .select("id, role_id")
      .eq("status", "published"),
    supabase.auth.getClaims(),
  ]);

  const pendingInvitationIds = (pendingResult.data ?? []).map(
    (invitation) => invitation.id,
  );
  const grantsResult = await loadPendingInvitationGrants(
    async (invitationIds) =>
      supabase
        .from("organisation_invitation_grants")
        .select("invitation_id, scope_type, scope_unit_id, role_version_id")
        .in("invitation_id", [...invitationIds]),
    pendingInvitationIds,
  );

  const activeUnits = allUnits.filter((unit) => unit.status === "active");
  const firstSite =
    activeUnits.find((unit) => isSiteUnitType(unit.unit_type ?? null)) ??
    activeUnits.find((unit) => !unit.parent_unit_id) ??
    null;
  const childUnitCount = activeUnits.filter((unit) =>
    Boolean(unit.parent_unit_id),
  ).length;

  const ownerMembershipIds = new Set(
    (ownerGrantsResult.data ?? [])
      .filter((grant) => {
        const roleVersion = grant.role_versions as {
          status: string;
          roles: { is_owner_role: boolean; status: string };
        } | null;
        return (
          roleVersion?.status === "published" &&
          roleVersion.roles?.is_owner_role === true &&
          roleVersion.roles?.status === "active"
        );
      })
      .map((grant) => grant.grantee_membership_id),
  );

  const membershipRows = membershipsResult.data ?? [];
  const membershipUserIds = [
    ...new Set(membershipRows.map((membership) => membership.user_id)),
  ];
  const profilesResult =
    membershipUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", membershipUserIds)
      : { data: [] as Array<{ user_id: string; display_name: string | null }> };
  const profileNameByUserId = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]),
  );
  const currentUserId =
    typeof claimsResult.data?.claims?.sub === "string"
      ? claimsResult.data.claims.sub
      : null;

  const members: StructureFirstMember[] = membershipRows.map((membership) => ({
    membershipId: membership.id,
    displayName: memberDisplayName({
      membershipName: membership.display_name,
      profileName: profileNameByUserId.get(membership.user_id),
      isCurrentUser: membership.user_id === currentUserId,
    }),
  }));
  const owners: StructureFirstOwner[] = members.filter((member) =>
    ownerMembershipIds.has(member.membershipId),
  );

  const roleNameByVersionId = new Map<string, string>();
  const roleIdToName = new Map(
    (rolesResult.data ?? []).map((role) => [role.id, role.display_name]),
  );
  for (const version of roleVersionsResult.data ?? []) {
    const roleName = roleIdToName.get(version.role_id);
    if (roleName) {
      roleNameByVersionId.set(version.id, roleName);
    }
  }

  const grantsByInvitation = new Map<
    string,
    { roleName: string; scopeLabel: string }
  >();
  for (const grant of grantsResult.data ?? []) {
    const scopeUnitId = grant.scope_unit_id ?? "";
    grantsByInvitation.set(grant.invitation_id, {
      roleName:
        roleNameByVersionId.get(grant.role_version_id) ?? "Application access",
      scopeLabel:
        grant.scope_type === "organisation"
          ? "Entire organisation"
          : scopeUnitId
            ? `Specific site: ${formatUnitPath(scopeUnitId, allUnits)}`
            : "Specific site",
    });
  }

  const pendingInvitations: StructureFirstPendingInvitation[] = (
    pendingResult.data ?? []
  ).map((invitation) => {
    const grant = grantsByInvitation.get(invitation.id);
    return {
      id: invitation.id,
      email: invitation.canonical_recipient,
      expiresAtLabel: formatLongDate(invitation.expires_at),
      roleName: grant?.roleName ?? "Application access",
      scopeLabel: grant?.scopeLabel ?? "Scoped access",
    };
  });

  const jobFunctions: StructureFirstJobFunction[] = (
    jobFunctionsResult.data ?? []
  ).map((jobFunction) => ({
    id: jobFunction.id,
    name: jobFunction.name,
    code: jobFunction.code,
    description: jobFunction.description,
  }));

  const planCode =
    billing?.plan_code && isPlanCode(billing.plan_code)
      ? billing.plan_code
      : null;
  const events = parseOnboardingEvents(eventsResult.data ?? []);
  const organisation = organisationResult.data;

  const facts: StructureFirstFacts = {
    organisationName: organisation?.name ?? null,
    organisationStatus: organisation?.status ?? null,
    organisationLocale: organisation?.locale ?? null,
    organisationTimeZone: organisation?.time_zone ?? null,
    reportingCurrency: organisation?.reporting_currency ?? null,
    multiSiteIntent: organisation?.multi_site_intent ?? null,
    billingPlanCode: planCode,
    billingPlanName: planCode ? PLAN_CATALOGUE[planCode].name : null,
    firstSiteName: firstSite?.name ?? null,
    firstSiteId: firstSite?.id ?? null,
    activeUnitCount: activeUnits.length,
    childUnitCount,
    activeJobFunctionCount: jobFunctions.length,
    activeMembershipCount: members.length,
    pendingInvitationCount: pendingInvitations.length,
    ownerDisplayName: owners[0]?.displayName ?? null,
    onboardingJourneyStarted:
      journeySnapshot?.journey.onboardingStatus === "in_progress" ||
      journeySnapshot?.journey.onboardingStatus === "completed" ||
      events.length > 0 ||
      childUnitCount > 0 ||
      jobFunctions.length > 0 ||
      members.length > 1 ||
      pendingInvitations.length > 0,
    events,
  };

  const progress = buildStructureFirstProgress(facts);
  const visibleStep = resolveVisibleStructureFirstStep({
    facts,
    requestedStep,
  });
  const tree = buildOrganisationUnitTree(activeUnits);
  const offers = filterDelegatableOffersForActiveSite(
    (offersData.offers ?? []) as DelegatableAccessOffer[],
    allUnits,
    siteContext,
  );

  return {
    facts,
    progress,
    visibleStep,
    units: allUnits,
    tree,
    jobFunctions,
    members,
    owners,
    pendingInvitations,
    permissions,
    guidance: buildStructureFirstGuidance({
      unitNames: activeUnits.map((unit) => unit.name),
      jobFunctionNames: jobFunctions.map((jobFunction) => jobFunction.name),
      childUnitCount,
      activeJobFunctionCount: jobFunctions.length,
      activeMembershipCount: members.length,
      pendingInvitationCount: pendingInvitations.length,
    }),
    offers,
  };
}
