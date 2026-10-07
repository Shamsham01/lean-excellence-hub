"use server";

import { revalidatePath } from "next/cache";

import { organisationNameMatchesConfirmation } from "@/modules/organisation-ownership/confirmation";
import { toOwnershipTransferErrorMessage } from "@/modules/organisation-ownership/errors";
import { loadOrganisationOwnership } from "@/modules/organisation-ownership/queries";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function revalidateOwnershipSurfaces() {
  revalidatePath("/platform", "layout");
  revalidatePath("/platform/settings/organisation");
  revalidatePath("/platform/settings/organisation/ownership");
  revalidatePath("/platform/settings/organisation/rollout");
  revalidatePath("/platform/people");
  revalidatePath("/platform/setup");
}

export async function transferOrganisationOwnership(input: {
  targetMembershipId: string;
  confirmationName: string;
}): Promise<{ error: string } | { ok: true }> {
  const ownership = await loadOrganisationOwnership();
  if (!ownership?.canTransfer) {
    return {
      error: "Only the current organisation owner can transfer ownership.",
    };
  }

  if (
    !organisationNameMatchesConfirmation(
      ownership.organisationName,
      input.confirmationName,
    )
  ) {
    return {
      error: `Type ${ownership.organisationName} exactly to confirm.`,
    };
  }

  const targetMembershipId = input.targetMembershipId.trim();
  if (!targetMembershipId) {
    return {
      error:
        "Choose an active member of this organisation. Invite them first if they are not yet a member.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("transfer_organisation_ownership", {
    target_membership_id: targetMembershipId,
  });

  if (error) {
    return { error: toOwnershipTransferErrorMessage(error) };
  }

  revalidateOwnershipSurfaces();
  return { ok: true as const };
}
