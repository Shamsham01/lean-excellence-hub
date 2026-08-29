import { validateApplicationOrigin } from "./origin.ts";

const AUTH_CONFIRM_TYPE_BY_ACTION: Record<string, string> = {
  signup: "signup",
  recovery: "recovery",
  invite: "invite",
  magiclink: "magiclink",
  email_change: "email_change",
  email_change_new: "email_change",
};

export function resolveAuthConfirmType(emailActionType: string): string | null {
  return AUTH_CONFIRM_TYPE_BY_ACTION[emailActionType] ?? null;
}

export function buildAuthConfirmUrl(
  origin: string,
  tokenHash: string,
  emailActionType: string,
): string | null {
  const confirmType = resolveAuthConfirmType(emailActionType);
  if (!confirmType || !tokenHash) {
    return null;
  }

  const validatedOrigin = validateApplicationOrigin(origin);
  const url = new URL("/auth/confirm", validatedOrigin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", confirmType);
  return url.toString();
}

export function resolveTokenHashForAction(
  emailActionType: string,
  tokenHash: string,
  tokenHashNew: string,
): string | null {
  if (emailActionType === "email_change_new") {
    return tokenHashNew || null;
  }

  return tokenHash || null;
}
