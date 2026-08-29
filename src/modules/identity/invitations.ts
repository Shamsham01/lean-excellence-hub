import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

export async function acceptInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("Invitation is unavailable.");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.refreshSession();
  const { data, error } = await supabase.rpc("accept_organisation_invitation", {
    invitation_token_digest: invitationTokenDigest(token),
  });

  if (error || !data) {
    throw new Error("Invitation is unavailable.");
  }

  return data as string;
}
