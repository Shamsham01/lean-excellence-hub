"use server";

import { revalidatePath } from "next/cache";

import {
  isSiteCapacityExhaustedError,
  SITE_CAPACITY_EXHAUSTED,
  siteCapacityExhaustedUserMessage,
} from "@/modules/billing/site-capacity";
import type { StructureMutationResult } from "@/modules/organisation/structure-mutation";
import { friendlyRpcError } from "@/modules/organisation/structure-errors";
import { validateOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function mapStructureError(
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  },
  fallback: string,
): Promise<StructureMutationResult> {
  if (isSiteCapacityExhaustedError(error)) {
    const canManageBilling = await currentMemberHasPermission("billing.manage");
    return {
      error: siteCapacityExhaustedUserMessage(canManageBilling),
      errorCode: SITE_CAPACITY_EXHAUSTED,
      canManageBilling,
    };
  }

  return { error: friendlyRpcError(error, fallback) };
}

async function resolveOrganisationId() {
  const supabase = await createServerSupabaseClient();
  const orgId = await supabase.rpc("current_organisation_id");
  if (orgId.error || !orgId.data) {
    return { error: "Organisation context is unavailable." as const };
  }
  return { organisationId: orgId.data as string };
}

export async function createOrganisationUnit(input: {
  parentUnitId: string | null;
  code: string;
  name: string;
  unitType: string;
}): Promise<StructureMutationResult> {
  const validation = validateOrganisationUnitCode(input.code);
  if (!validation.ok) {
    return { error: validation.message };
  }

  const authorised =
    input.parentUnitId === null
      ? await currentMemberHasOrganisationScopedPermission("hierarchy.manage")
      : await currentMemberHasScopedPermission(
          "hierarchy.manage",
          input.parentUnitId,
        );

  if (!authorised) {
    return { error: "You are not authorised to create this unit." };
  }

  const org = await resolveOrganisationId();
  if ("error" in org) {
    return { error: org.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_organisation_unit", {
    target_organisation_id: org.organisationId,
    target_parent_unit_id: input.parentUnitId as string,
    unit_code: validation.normalised,
    unit_name: input.name.trim(),
    unit_type: input.unitType.trim(),
  });

  if (error) {
    return mapStructureError(
      error,
      "Unable to create the unit. Check the details and try again.",
    );
  }

  revalidateStructurePaths();
  return { ok: true as const };
}

export async function updateOrganisationUnit(input: {
  unitId: string;
  name: string;
  unitType: string;
}): Promise<StructureMutationResult> {
  const authorised = await currentMemberHasScopedPermission(
    "hierarchy.manage",
    input.unitId,
  );
  if (!authorised) {
    return { error: "You are not authorised to edit this unit." };
  }

  if (!input.name.trim()) {
    return { error: "Enter a unit name." };
  }
  if (!input.unitType.trim()) {
    return { error: "Enter a unit type." };
  }

  const org = await resolveOrganisationId();
  if ("error" in org) {
    return { error: org.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_organisation_unit", {
    target_organisation_id: org.organisationId,
    target_unit_id: input.unitId,
    unit_name: input.name.trim(),
    unit_type: input.unitType.trim(),
  });

  if (error) {
    return mapStructureError(
      error,
      "Unable to update the unit. Check the details and try again.",
    );
  }

  revalidateStructurePaths();
  return { ok: true as const };
}

export async function moveOrganisationUnit(input: {
  unitId: string;
  parentUnitId: string | null;
}): Promise<StructureMutationResult> {
  const canManageUnit = await currentMemberHasScopedPermission(
    "hierarchy.manage",
    input.unitId,
  );
  const canManageParent =
    input.parentUnitId === null
      ? await currentMemberHasOrganisationScopedPermission("hierarchy.manage")
      : await currentMemberHasScopedPermission(
          "hierarchy.manage",
          input.parentUnitId,
        );

  if (!canManageUnit || !canManageParent) {
    return { error: "You are not authorised to move this unit." };
  }

  const org = await resolveOrganisationId();
  if ("error" in org) {
    return { error: org.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("move_organisation_unit", {
    target_organisation_id: org.organisationId,
    target_unit_id: input.unitId,
    target_parent_unit_id: input.parentUnitId as string,
  });

  if (error) {
    return mapStructureError(
      error,
      "Unable to move the unit. Check placement authority and try again.",
    );
  }

  revalidateStructurePaths();
  return { ok: true as const };
}

export async function retireOrganisationUnit(input: {
  unitId: string;
  reason: string;
}): Promise<StructureMutationResult> {
  const authorised = await currentMemberHasScopedPermission(
    "hierarchy.manage",
    input.unitId,
  );
  if (!authorised) {
    return { error: "You are not authorised to archive this unit." };
  }

  if (!input.reason.trim()) {
    return { error: "Enter a reason for archiving this unit." };
  }

  const org = await resolveOrganisationId();
  if ("error" in org) {
    return { error: org.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_organisation_unit_status", {
    target_organisation_id: org.organisationId,
    target_unit_id: input.unitId,
    target_status: "retired",
    change_reason: input.reason.trim(),
  });

  if (error) {
    return mapStructureError(
      error,
      "Unable to archive the unit. Resolve blockers and try again.",
    );
  }

  revalidateStructurePaths();
  return { ok: true as const };
}

export async function restoreOrganisationUnit(input: {
  unitId: string;
}): Promise<StructureMutationResult> {
  const authorised = await currentMemberHasScopedPermission(
    "hierarchy.manage",
    input.unitId,
  );
  if (!authorised) {
    return { error: "You are not authorised to reactivate this unit." };
  }

  const org = await resolveOrganisationId();
  if ("error" in org) {
    return { error: org.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_organisation_unit_status", {
    target_organisation_id: org.organisationId,
    target_unit_id: input.unitId,
    target_status: "active",
    change_reason: "Reactivated by administrator",
  });

  if (error) {
    return mapStructureError(
      error,
      "Unable to reactivate the unit. Check the parent unit is active.",
    );
  }

  revalidateStructurePaths();
  return { ok: true as const };
}

function revalidateStructurePaths() {
  revalidatePath("/platform/settings/structure");
  revalidatePath("/platform/settings/billing");
  revalidatePath("/platform/setup");
  revalidatePath("/platform");
  revalidatePath("/platform/people");
  revalidatePath("/platform/settings/people");
  revalidatePath("/onboarding/setup");
}
