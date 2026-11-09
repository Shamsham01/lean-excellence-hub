import "server-only";

export {
  INVITATION_INBOX_PROOF_COOKIE,
  isInvitationInboxProofValue,
} from "@/modules/identity/invitation-inbox-cookie-constants";

const COOKIE_MAX_AGE_SECONDS = 60 * 60;

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
