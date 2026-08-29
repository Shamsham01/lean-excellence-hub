export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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

export function safeInvitationContinuation(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (!/^\/invitations\/[A-Za-z0-9_-]{43}$/.test(value.split("?")[0] ?? "")) {
    return null;
  }

  return value.split("?")[0] ?? null;
}
