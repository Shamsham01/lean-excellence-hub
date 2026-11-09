export const INVITATION_INBOX_PROOF_COOKIE = "leh_invitation_inbox_proof";

const INBOX_PROOF_PATTERN = /^[A-Za-z0-9_-]{16,86}$/;

export function isInvitationInboxProofValue(
  value: string | undefined,
): value is string {
  return Boolean(value && INBOX_PROOF_PATTERN.test(value));
}
