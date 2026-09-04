import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/platform/supabase/server";
import type { RouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

export async function acceptInvitation(
  token: string,
  supabase: RouteHandlerSupabaseClient | null = null,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("Invitation is unavailable.");
  }

  const client = supabase ?? (await createServerSupabaseClient());
  await client.auth.refreshSession();
  const { data, error } = await client.rpc("accept_organisation_invitation", {
    invitation_token_digest: invitationTokenDigest(token),
  });

  if (error || !data) {
    throw new Error("Invitation is unavailable.");
  }

  return data as string;
}

export async function acceptInvitationSignupBinding(
  bindingId: string,
  supabase: RouteHandlerSupabaseClient | null = null,
) {
  const client = supabase ?? (await createServerSupabaseClient());
  await client.auth.refreshSession();
  const { data, error } = await client.rpc(
    "accept_organisation_invitation_signup_binding",
    {
      target_binding_id: bindingId,
    },
  );

  if (error || !data) {
    throw new Error("Invitation is unavailable.");
  }

  return data as string;
}
