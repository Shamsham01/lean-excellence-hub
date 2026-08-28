"use server";

import { revalidatePath } from "next/cache";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import {
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function updateMemberDisplayName(
  membershipId: string,
  displayName: string,
) {
  const canManage = await currentMemberHasPermission("memberships.manage");
  if (!canManage) {
    return { error: "You do not have permission to update member details." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_organisation_membership_display_name",
    {
      target_membership_id: membershipId,
      target_display_name: displayName,
    },
  );

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to update display name."),
    };
  }

  revalidatePath(`/platform/people/${membershipId}`);
  revalidatePath(`/platform/people/${membershipId}/admin`);
  revalidatePath("/platform/people");
  return { ok: true as const };
}

export async function assignMemberJobFunction(input: {
  membershipId: string;
  jobFunctionId: string;
  organisationalUnitId: string;
}) {
  const canManage = await currentMemberHasPermission("job_functions.manage");
  if (!canManage) {
    return { error: "You do not have permission to assign job functions." };
  }

  const canAssignUnit = await currentMemberHasScopedPermission(
    "hierarchy.read",
    input.organisationalUnitId,
  );
  if (!canAssignUnit) {
    return {
      error: "You do not have permission to assign this organisation unit.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("assign_membership_job_function", {
    target_membership_id: input.membershipId,
    target_job_function_id: input.jobFunctionId,
    target_primary: true,
    target_organisational_unit_id: input.organisationalUnitId,
    target_assignment_reason: "Assigned by administrator",
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to update organisation assignment.",
      ),
    };
  }

  revalidatePath(`/platform/people/${input.membershipId}`);
  revalidatePath(`/platform/people/${input.membershipId}/admin`);
  revalidatePath("/platform/people");
  revalidatePath("/platform/setup");
  revalidatePath("/platform/suggestions/new");
  return { ok: true as const };
}
