import "server-only";

import { invitationInboxProofDigest } from "@/modules/identity/invitation-inbox-proof";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function attestOrganisationInvitationInbox(
  invitationToken: string,
  inboxProof: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("attest_organisation_invitation_inbox", {
    invitation_token_digest: invitationTokenDigest(invitationToken),
    target_inbox_proof_digest: invitationInboxProofDigest(inboxProof),
  });

  if (error) {
    return false;
  }

  return data === true;
}
