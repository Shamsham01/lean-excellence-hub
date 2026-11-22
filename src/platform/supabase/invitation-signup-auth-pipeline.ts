import { invitationInboxProofDigest } from "@/modules/identity/invitation-inbox-proof";
import { invitationTokenDigest } from "@/modules/identity/invitations";

export type RpcResult<T> = { data: T | null; error: Error | null };

export type InvitationSignupAuthDeps = {
  authorizeInvitationSignup: (args: {
    target_binding_id: string;
    target_user_email: string;
    invitation_token_digest: string;
    target_inbox_proof_digest: string;
  }) => Promise<RpcResult<boolean>>;
  finaliseInvitationSignup: (args: {
    target_binding_id: string;
    target_user_id: string;
    invitation_token_digest: string;
    target_inbox_proof_digest: string;
  }) => Promise<RpcResult<boolean>>;
  redeemInvitationInboxProof: (args: {
    invitation_token_digest: string;
    target_inbox_proof_digest: string;
    target_binding_id: string;
  }) => Promise<RpcResult<boolean>>;
  clearInvitationSignupBindingAuthUser: (args: {
    target_binding_id: string;
  }) => Promise<RpcResult<boolean>>;
  createAuthUser: (input: {
    email: string;
    password: string;
    invitationSignupBindingId: string;
  }) => Promise<{ userId?: string; error?: Error | null }>;
  deleteAuthUser: (userId: string) => Promise<void>;
};

export async function createConfirmedInvitationAuthUserWithDeps(
  input: {
    email: string;
    password: string;
    invitationSignupBindingId: string;
    invitationToken: string;
    inboxProof: string;
  },
  deps: InvitationSignupAuthDeps,
): Promise<{ userId?: string; error?: Error }> {
  const tokenDigest = invitationTokenDigest(input.invitationToken);
  const proofDigest = invitationInboxProofDigest(input.inboxProof);

  const authorized = await deps.authorizeInvitationSignup({
    target_binding_id: input.invitationSignupBindingId,
    target_user_email: input.email,
    invitation_token_digest: tokenDigest,
    target_inbox_proof_digest: proofDigest,
  });

  if (authorized.error || authorized.data !== true) {
    return {
      error: new Error(
        "Account creation requires a valid organisation invitation.",
      ),
    };
  }

  const created = await deps.createAuthUser({
    email: input.email,
    password: input.password,
    invitationSignupBindingId: input.invitationSignupBindingId,
  });

  if (created.error || !created.userId) {
    return { error: created.error ?? new Error("Unable to create account.") };
  }

  const userId = created.userId;

  const finalised = await deps.finaliseInvitationSignup({
    target_binding_id: input.invitationSignupBindingId,
    target_user_id: userId,
    invitation_token_digest: tokenDigest,
    target_inbox_proof_digest: proofDigest,
  });

  if (finalised.error || finalised.data !== true) {
    await deps.deleteAuthUser(userId);
    await deps.clearInvitationSignupBindingAuthUser({
      target_binding_id: input.invitationSignupBindingId,
    });
    return {
      error: new Error("This invitation is no longer available."),
    };
  }

  const redeemed = await deps.redeemInvitationInboxProof({
    invitation_token_digest: tokenDigest,
    target_inbox_proof_digest: proofDigest,
    target_binding_id: input.invitationSignupBindingId,
  });

  if (redeemed.error || redeemed.data !== true) {
    await deps.clearInvitationSignupBindingAuthUser({
      target_binding_id: input.invitationSignupBindingId,
    });
    await deps.deleteAuthUser(userId);
    return {
      error: new Error(
        "This invitation email link has already been used or is no longer valid.",
      ),
    };
  }

  return { userId };
}
