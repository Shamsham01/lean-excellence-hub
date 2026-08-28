"use server";

import { revalidatePath } from "next/cache";

import { validateOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function friendlyRpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return "You are not authorised to perform this action.";
  }
  if (error.code === "23505") {
    return "A unit with this code already exists.";
  }
  if (error.code === "23514") {
    return "Check the unit details and try again.";
  }
  return "Unable to create the unit. Check the details and try again.";
}

export async function createOrganisationUnit(input: {
  parentUnitId: string | null;
  code: string;
  name: string;
  unitType: string;
}) {
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

  const supabase = await createServerSupabaseClient();
  const orgId = await supabase.rpc("current_organisation_id");
  if (orgId.error || !orgId.data) {
    return { error: "Organisation context is unavailable." };
  }

  const { error } = await supabase.rpc("create_organisation_unit", {
    target_organisation_id: orgId.data,
    target_parent_unit_id: input.parentUnitId as string,
    unit_code: validation.normalised,
    unit_name: input.name.trim(),
    unit_type: input.unitType.trim(),
  });

  if (error) {
    return { error: friendlyRpcError(error) };
  }

  revalidatePath("/platform/settings/structure");
  revalidatePath("/platform/setup");
  revalidatePath("/platform");

  return { ok: true as const };
}
