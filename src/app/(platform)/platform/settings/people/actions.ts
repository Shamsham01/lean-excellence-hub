"use server";

import { revalidatePath } from "next/cache";

import {
  createInvitationToken,
  invitationTokenDigest,
} from "@/modules/identity/invitations";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function inviteColleague(input: {
  email: string;
  displayName?: string;
  roleVersionId: string;
  scopeType: string;
  scopeUnitId: string | null;
  jobFunctionId?: string;
  organisationalUnitId?: string;
}) {
  const canManage =
    (await currentMemberHasPermission("invitations.manage")) &&
    (await currentMemberHasPermission("roles.delegate"));
  if (!canManage) {
    return { error: "You do not have permission to send invitations." };
  }

  const token = createInvitationToken();
  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .maybeSingle();

  if (!organisation?.id) {
    return { error: "Unable to send the invitation. Try again later." };
  }

  const { data: invitationId, error } = await supabase.rpc(
    "issue_organisation_member_invitation",
    {
      invitation_recipient_type: "email",
      invitation_canonical_recipient: input.email,
      invitation_token_digest: invitationTokenDigest(token),
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      offered_role_version_id: input.roleVersionId,
      offered_scope_type: input.scopeType,
      ...(input.scopeUnitId
        ? { offered_scope_unit_id: input.scopeUnitId }
        : {}),
      ...(input.displayName
        ? { intended_display_name: input.displayName }
        : {}),
      ...(input.jobFunctionId
        ? { intended_job_function_id: input.jobFunctionId }
        : {}),
      ...(input.organisationalUnitId
        ? { intended_organisational_unit_id: input.organisationalUnitId }
        : {}),
    },
  );

  if (error || !invitationId) {
    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to send the invitation. Check the details and try again.",
      ),
    };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/platform/setup");

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    ok: true as const,
    invitationUrl: `${origin}/invitations/${token}`,
  };
}

export async function revokeInvitation(invitationId: string) {
  const canManage = await currentMemberHasPermission("invitations.manage");
  if (!canManage) {
    return { error: "You do not have permission to revoke invitations." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .maybeSingle();

  if (!organisation?.id) {
    return { error: "Unable to revoke the invitation." };
  }

  const { error } = await supabase.rpc("revoke_organisation_invitation", {
    target_organisation_id: organisation.id,
    target_invitation_id: invitationId,
    change_reason: "Revoked by administrator",
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to revoke the invitation."),
    };
  }

  revalidatePath("/platform/settings/people");
  return { ok: true as const };
}
