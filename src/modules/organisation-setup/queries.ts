import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import { buildOrganisationSetupSnapshot } from "./readiness";
import { loadSetupPermissions } from "./permissions";
import type { SetupQueryResult } from "./types";

export { loadSetupPermissions } from "./permissions";

function isPermissionDenied(error: { code?: string } | null) {
  return error?.code === "42501";
}

async function countActiveUnits(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { count, error } = await supabase
    .from("organisation_units")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { count: count ?? 0, unavailable: false as const };
}

async function hasChildUnits(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data, error } = await supabase
    .from("organisation_units")
    .select("id")
    .eq("status", "active")
    .not("parent_unit_id", "is", null)
    .limit(1);

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { hasChild: (data?.length ?? 0) > 0, unavailable: false as const };
}

async function checkOrganisationOwner(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data: grants, error } = await supabase
    .from("access_grants")
    .select(
      "id, scope_type, status, grantee_membership_id, role_versions!inner(status, roles!inner(is_owner_role, status))",
    )
    .eq("status", "active")
    .eq("scope_type", "organisation");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }

  const ownerGrants = (grants ?? []).filter((grant) => {
    const roleVersion = grant.role_versions as {
      status: string;
      roles: { is_owner_role: boolean; status: string };
    } | null;
    return (
      roleVersion?.status === "published" &&
      roleVersion.roles?.is_owner_role === true &&
      roleVersion.roles?.status === "active"
    );
  });

  if (ownerGrants.length === 0) {
    return { hasOwner: false, unavailable: false as const };
  }

  const membershipIds = ownerGrants.map((g) => g.grantee_membership_id);
  const { data: memberships, error: membershipError } = await supabase
    .from("organisation_memberships")
    .select("id, status")
    .in("id", membershipIds)
    .eq("status", "active");

  if (isPermissionDenied(membershipError)) {
    return { unavailable: true as const };
  }

  return {
    hasOwner: (memberships?.length ?? 0) > 0,
    unavailable: false as const,
  };
}

async function countActiveMemberships(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { count, error } = await supabase
    .from("organisation_memberships")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { count: count ?? 0, unavailable: false as const };
}

async function countPendingInvitations(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { count, error } = await supabase
    .from("organisation_invitations")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { count: count ?? 0, unavailable: false as const };
}

async function checkGrants(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data: grants, error } = await supabase
    .from("access_grants")
    .select(
      "id, status, role_versions!inner(status, roles!inner(is_owner_role, status))",
    )
    .eq("status", "active");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }

  const nonOwnerCount = (grants ?? []).filter((grant) => {
    const roleVersion = grant.role_versions as {
      status: string;
      roles: { is_owner_role: boolean; status: string };
    } | null;
    return (
      roleVersion?.status === "published" &&
      roleVersion.roles?.is_owner_role === false &&
      roleVersion.roles?.status === "active"
    );
  }).length;

  return { nonOwnerGrantCount: nonOwnerCount, unavailable: false as const };
}

async function checkCustomRolesWithoutGrants(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data: roles, error } = await supabase
    .from("roles")
    .select("id, is_owner_role, status, role_versions(id, status)")
    .eq("status", "active")
    .eq("is_owner_role", false);

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }

  const customRoles = roles ?? [];
  if (customRoles.length === 0) {
    return { hasCustomRoleWithoutGrant: false, unavailable: false as const };
  }

  const { data: grants, error: grantsError } = await supabase
    .from("access_grants")
    .select("role_version_id")
    .eq("status", "active");

  if (isPermissionDenied(grantsError)) {
    return { unavailable: true as const };
  }

  const grantedVersionIds = new Set(
    (grants ?? []).map((g) => g.role_version_id),
  );

  const hasUngranted = customRoles.some((role) => {
    const versions = role.role_versions as { id: string; status: string }[];
    return versions.some(
      (version) =>
        version.status === "published" && !grantedVersionIds.has(version.id),
    );
  });

  return {
    hasCustomRoleWithoutGrant: hasUngranted,
    unavailable: false as const,
  };
}

async function countJobFunctions(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { count, error } = await supabase
    .from("job_functions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { count: count ?? 0, unavailable: false as const };
}

async function countJobFunctionAssignments(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { count, error } = await supabase
    .from("membership_job_function_assignments")
    .select("id", { count: "exact", head: true })
    .is("valid_to", null);

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }
  return { count: count ?? 0, unavailable: false as const };
}

async function countLeanConfigSignals(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const tables = [
    "maturity_models",
    "five_s_standards",
    "gemba_definitions",
    "suggestion_programmes",
    "templates",
  ] as const;

  let signalCount = 0;
  let denied = 0;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });

    if (isPermissionDenied(error)) {
      denied += 1;
      continue;
    }
    if ((count ?? 0) > 0) {
      signalCount += 1;
    }
  }

  if (denied === tables.length) {
    return { unavailable: true as const };
  }

  return { signalCount, unavailable: false as const };
}

async function checkCurrentAdminPrimaryAssignment(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data, error } = await supabase.rpc(
    "get_current_membership_primary_unit",
  );

  if (isPermissionDenied(error)) {
    return { unavailable: true as const };
  }

  const payload = data as { has_primary_unit?: boolean } | null;
  return {
    hasAssignment: payload?.has_primary_unit === true,
    unavailable: false as const,
  };
}

async function countTrainingCatalog(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const [courses, curricula] = await Promise.all([
    supabase
      .from("training_courses")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("training_curricula")
      .select("id", { count: "exact", head: true }),
  ]);

  if (
    isPermissionDenied(courses.error) &&
    isPermissionDenied(curricula.error)
  ) {
    return { unavailable: true as const };
  }

  return {
    count: (courses.count ?? 0) + (curricula.count ?? 0),
    unavailable: false as const,
  };
}

export async function loadSetupQueryResult(): Promise<SetupQueryResult> {
  const supabase = await createServerSupabaseClient();

  const { data: organisation, error: orgError } = await supabase
    .from("organisations")
    .select("name, code, status")
    .maybeSingle();

  if (orgError && !isPermissionDenied(orgError)) {
    throw new Error("Unable to load organisation.");
  }

  const [
    units,
    childUnits,
    owner,
    memberships,
    invitations,
    grants,
    customRoles,
    jobFunctions,
    jobAssignments,
    adminAssignment,
    leanConfig,
    training,
  ] = await Promise.all([
    countActiveUnits(supabase),
    hasChildUnits(supabase),
    checkOrganisationOwner(supabase),
    countActiveMemberships(supabase),
    countPendingInvitations(supabase),
    checkGrants(supabase),
    checkCustomRolesWithoutGrants(supabase),
    countJobFunctions(supabase),
    countJobFunctionAssignments(supabase),
    checkCurrentAdminPrimaryAssignment(supabase),
    countLeanConfigSignals(supabase),
    countTrainingCatalog(supabase),
  ]);

  return {
    organisationStatus: organisation?.status ?? null,
    organisationName: organisation?.name ?? null,
    organisationCode: organisation?.code ?? null,
    activeUnitCount: units.unavailable ? null : units.count,
    activeUnitCountUnavailable: units.unavailable,
    hasOrganisationOwner: owner.unavailable ? null : owner.hasOwner,
    ownerCheckUnavailable: owner.unavailable,
    activeMembershipCount: memberships.unavailable ? null : memberships.count,
    membershipCountUnavailable: memberships.unavailable,
    pendingInvitationCount: invitations.unavailable ? null : invitations.count,
    pendingInvitationsUnavailable: invitations.unavailable,
    nonOwnerGrantCount: grants.unavailable ? null : grants.nonOwnerGrantCount,
    grantsCheckUnavailable: grants.unavailable,
    customRoleWithoutGrant: customRoles.unavailable
      ? null
      : customRoles.hasCustomRoleWithoutGrant,
    customRolesCheckUnavailable: customRoles.unavailable,
    activeJobFunctionCount: jobFunctions.unavailable
      ? null
      : jobFunctions.count,
    jobFunctionsUnavailable: jobFunctions.unavailable,
    jobFunctionAssignmentCount: jobAssignments.unavailable
      ? null
      : jobAssignments.count,
    jobFunctionAssignmentsUnavailable: jobAssignments.unavailable,
    currentAdminHasPrimaryAssignment: adminAssignment.unavailable
      ? null
      : adminAssignment.hasAssignment,
    adminAssignmentUnavailable: adminAssignment.unavailable,
    leanConfigSignalCount: leanConfig.unavailable
      ? null
      : leanConfig.signalCount,
    leanConfigUnavailable: leanConfig.unavailable,
    trainingCatalogCount: training.unavailable ? null : training.count,
    trainingCatalogUnavailable: training.unavailable,
    hasChildUnits: childUnits.unavailable ? null : childUnits.hasChild,
    childUnitsUnavailable: childUnits.unavailable,
  };
}

export async function loadOrganisationSetupSnapshot() {
  const [data, permissions] = await Promise.all([
    loadSetupQueryResult(),
    loadSetupPermissions(),
  ]);
  return buildOrganisationSetupSnapshot(data, permissions);
}
