import "server-only";

export const INVITATION_INBOX_PROOF_COOKIE = "leh_invitation_inbox_proof";

const COOKIE_MAX_AGE_SECONDS = 60 * 60;
const INBOX_PROOF_PATTERN = /^[A-Za-z0-9_-]{16,86}$/;

export function isInvitationInboxProofValue(
  value: string | undefined,
): value is string {
  return Boolean(value && INBOX_PROOF_PATTERN.test(value));
}

export function invitationInboxProofCookieOptions(
  invitationToken: string,
  secure: boolean,
) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: `/invitations/${invitationToken}/activate`,
  };
}
