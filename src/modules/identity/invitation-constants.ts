export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const INVITATION_SIGNUP_BINDING_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function invitationExpiresAt(from = Date.now()) {
  return new Date(from + INVITATION_TTL_MS).toISOString();
}

export function isInvitationPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/invitations/")) {
    return false;
  }

  const token = value.replace(/^\/invitations\//, "").split("?")[0] ?? "";
  return INVITATION_TOKEN_PATTERN.test(token);
}

export function invitationPathFromToken(token: string) {
  return `/invitations/${token}`;
}

export function invitationContinuePath(bindingId: string) {
  return `/invitations/continue/${bindingId}`;
}

export function isInvitationSignupBindingId(
  value: string | null | undefined,
): value is string {
  return Boolean(value && INVITATION_SIGNUP_BINDING_PATTERN.test(value.trim()));
}

export function safeInvitationContinuation(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const path = value.split("?")[0] ?? "";

  if (INVITATION_TOKEN_PATTERN.test(path.replace(/^\/invitations\//, ""))) {
    return path;
  }

  if (
    path.startsWith("/invitations/continue/") &&
    isInvitationSignupBindingId(path.replace("/invitations/continue/", ""))
  ) {
    return path;
  }

  return null;
}
