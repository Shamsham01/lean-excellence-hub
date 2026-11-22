import "server-only";

import { invitationInboxProofDigest } from "@/modules/identity/invitation-inbox-proof";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { createSecretClient } from "@/platform/supabase/secret";

export async function redeemOrganisationInvitationInboxProof(input: {
  invitationToken: string;
  inboxProof: string;
  bindingId: string;
}) {
  const supabase = createSecretClient();
  const { data, error } = await supabase.rpc(
    "redeem_organisation_invitation_inbox_proof",
    {
      invitation_token_digest: invitationTokenDigest(input.invitationToken),
      target_inbox_proof_digest: invitationInboxProofDigest(input.inboxProof),
      target_binding_id: input.bindingId,
    },
  );

  if (error) {
    return false;
  }

  return data === true;
}
