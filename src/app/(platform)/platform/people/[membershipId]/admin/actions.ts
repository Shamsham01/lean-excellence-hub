"use server";

import { revalidatePath } from "next/cache";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import {
  currentMemberHasDelegatableAccess,
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
  const canManage =
    (await currentMemberHasPermission("job_functions.manage")) ||
    (await currentMemberHasScopedPermission(
      "job_functions.manage",
      input.organisationalUnitId,
    ));
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

export async function grantMemberAccess(input: {
  membershipId: string;
  roleVersionId: string;
  scopeType: string;
  scopeUnitId: string | null;
}) {
  const canDelegate = await currentMemberHasDelegatableAccess();
  if (!canDelegate) {
    return {
      error: "You do not have permission to delegate application access.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .maybeSingle();

  if (!organisation?.id) {
    return { error: "Unable to update application access." };
  }

  const { error } = await supabase.rpc("grant_role_version", {
    target_organisation_id: organisation.id,
    target_grantee_membership_id: input.membershipId,
    target_role_version_id: input.roleVersionId,
    target_scope_type: input.scopeType,
    ...(input.scopeUnitId ? { target_scope_unit_id: input.scopeUnitId } : {}),
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to grant application access. Check the role and scope are within your authority.",
      ),
    };
  }

  revalidatePath(`/platform/people/${input.membershipId}/admin`);
  return { ok: true as const };
}

export async function revokeMemberAccess(
  membershipId: string,
  grantId: string,
) {
  const canDelegate = await currentMemberHasDelegatableAccess();
  if (!canDelegate) {
    return {
      error: "You do not have permission to revoke application access.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .maybeSingle();

  if (!organisation?.id) {
    return { error: "Unable to revoke application access." };
  }

  const { error } = await supabase.rpc("revoke_access_grant", {
    target_organisation_id: organisation.id,
    target_grant_id: grantId,
    change_reason: "Revoked by administrator",
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to revoke application access.",
      ),
    };
  }

  revalidatePath(`/platform/people/${membershipId}/admin`);
  return { ok: true as const };
}
