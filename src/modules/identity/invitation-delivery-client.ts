import "server-only";

import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";

export type DispatchOrganisationInvitationEmailInput = {
  deliveryId: string;
  invitationToken: string;
  inboxProof: string;
};

export type DispatchOrganisationInvitationEmailResult =
  | { ok: true; deliveryId: string }
  | { ok: false; error: string; retryable?: boolean };

export async function dispatchOrganisationInvitationEmail(
  input: DispatchOrganisationInvitationEmailInput,
): Promise<DispatchOrganisationInvitationEmailResult> {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getServerEnvironment();

  try {
    const response = await fetch(
      `${publicEnvironment.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/organisation-invitation-delivery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serverEnvironment.SUPABASE_SECRET_KEY,
        },
        body: JSON.stringify({
          delivery_id: input.deliveryId,
          invitation_token: input.invitationToken,
          inbox_proof: input.inboxProof,
        }),
      },
    );

    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      let message = "Unable to send the invitation email.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error?.trim()) {
          message = payload.error;
        }
      } catch {
        // Keep generic copy.
      }
      return { ok: false, error: message, retryable };
    }

    const payload = (await response.json()) as { delivery_id?: string };
    return {
      ok: true,
      deliveryId: payload.delivery_id ?? input.deliveryId,
    };
  } catch {
    return {
      ok: false,
      error: "Unable to send the invitation email.",
      retryable: true,
    };
  }
}
