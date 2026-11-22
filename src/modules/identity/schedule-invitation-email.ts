import "server-only";

import {
  createInvitationInboxProof,
  invitationInboxProofDigest,
} from "@/modules/identity/invitation-inbox-proof";
import { dispatchOrganisationInvitationEmail } from "@/modules/identity/invitation-delivery-client";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type ScheduleInvitationEmailResult =
  | {
      ok: true;
      deliveryId: string;
      emailDispatched: true;
    }
  | {
      ok: true;
      deliveryId: string;
      emailDispatched: false;
      deliveryError: string;
      retryable?: boolean;
    }
  | { ok: false; error: string };

export async function scheduleAndDispatchOrganisationInvitationEmail(input: {
  invitationId: string;
  invitationToken: string;
}): Promise<ScheduleInvitationEmailResult> {
  const inboxProof = createInvitationInboxProof();
  const supabase = await createServerSupabaseClient();

  const { data: deliveryId, error: registerError } = await supabase.rpc(
    "register_organisation_invitation_delivery",
    {
      target_invitation_id: input.invitationId,
      target_inbox_proof_digest: invitationInboxProofDigest(inboxProof),
    },
  );

  if (registerError || !deliveryId) {
    return {
      ok: false,
      error: "Unable to prepare the invitation email.",
    };
  }

  const dispatched = await dispatchOrganisationInvitationEmail({
    deliveryId,
    invitationToken: input.invitationToken,
    inboxProof,
  });

  if (!dispatched.ok) {
    return {
      ok: true,
      deliveryId,
      emailDispatched: false,
      deliveryError: dispatched.error,
      ...(dispatched.retryable === undefined
        ? {}
        : { retryable: dispatched.retryable }),
    };
  }

  return {
    ok: true,
    deliveryId: dispatched.deliveryId,
    emailDispatched: true,
  };
}

export async function resendOrganisationInvitationEmail(input: {
  invitationId: string;
  invitationToken: string;
}): Promise<ScheduleInvitationEmailResult> {
  return scheduleAndDispatchOrganisationInvitationEmail(input);
}
