"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";
import {
  createInvitationToken,
  invitationTokenDigest,
} from "@/modules/identity/invitations";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  buildInvitationUrl,
  resolveApplicationOrigin,
} from "@/platform/application-origin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type InvitationGrantRequest = {
  roleVersionId: string;
  scopeType: string;
  scopeUnitId: string | null;
};

export async function inviteColleague(input: {
  email: string;
  displayName?: string;
  grants?: InvitationGrantRequest[];
  roleVersionId?: string;
  scopeType?: string;
  scopeUnitId?: string | null;
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

  const grants = resolveInvitationGrants(input);
  if (grants.length === 0) {
    return { error: "Select at least one application role and scope." };
  }

  const { data: invitationId, error } = await supabase.rpc(
    "issue_organisation_member_invitation_grants",
    {
      invitation_recipient_type: "email",
      invitation_canonical_recipient: input.email,
      invitation_token_digest: invitationTokenDigest(token),
      invitation_expires_at: invitationExpiresAt(),
      offered_grants: grants,
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
    if (error?.code === "23505") {
      return {
        error:
          "A pending invitation already exists for this email address. Reissue the existing invitation instead.",
        pendingDuplicate: true as const,
      };
    }

    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to send the invitation. Check the details and try again.",
      ),
    };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/platform/setup");
  revalidatePath("/onboarding/setup");

  const originResult = resolveApplicationOrigin({
    requestHeaders: await headers(),
  });

  if (!originResult.ok) {
    return { error: originResult.error };
  }

  return {
    ok: true as const,
    invitationUrl: buildInvitationUrl(originResult.origin, token),
  };
}

export async function reissueInvitation(invitationId: string) {
  const canManage = await currentMemberHasPermission("invitations.manage");
  if (!canManage) {
    return { error: "You do not have permission to reissue invitations." };
  }

  const token = createInvitationToken();
  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .maybeSingle();

  if (!organisation?.id) {
    return { error: "Unable to reissue the invitation." };
  }

  const { data: replacementId, error } = await supabase.rpc(
    "reissue_organisation_member_invitation",
    {
      target_invitation_id: invitationId,
      replacement_token_digest: invitationTokenDigest(token),
      replacement_expires_at: invitationExpiresAt(),
    },
  );

  if (error || !replacementId) {
    return {
      error: toCustomerErrorMessage(error, "Unable to reissue the invitation."),
    };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/onboarding/setup");

  const originResult = resolveApplicationOrigin({
    requestHeaders: await headers(),
  });

  if (!originResult.ok) {
    return { error: originResult.error };
  }

  return {
    ok: true as const,
    invitationUrl: buildInvitationUrl(originResult.origin, token),
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
  revalidatePath("/onboarding/setup");
  return { ok: true as const };
}

function resolveInvitationGrants(input: {
  grants?: InvitationGrantRequest[];
  roleVersionId?: string;
  scopeType?: string;
  scopeUnitId?: string | null;
}) {
  const requested =
    input.grants && input.grants.length > 0
      ? input.grants
      : input.roleVersionId && input.scopeType
        ? [
            {
              roleVersionId: input.roleVersionId,
              scopeType: input.scopeType,
              scopeUnitId: input.scopeUnitId ?? null,
            },
          ]
        : [];

  return requested.map((grant) => ({
    role_version_id: grant.roleVersionId,
    scope_type: grant.scopeType,
    scope_unit_id: grant.scopeUnitId,
  }));
}
