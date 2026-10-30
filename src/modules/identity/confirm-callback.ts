import type { EmailOtpType } from "@supabase/supabase-js";

import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";

export const CONFIRM_TOKEN_COOKIE = "leh_confirm_token_hash";
export const CONFIRM_TYPE_COOKIE = "leh_confirm_type";
export const CONFIRM_NEXT_COOKIE = "leh_confirm_next";
export const CONFIRM_INTENT_MAX_AGE_SECONDS = 10 * 60;
export const CONFIRM_STAGED_PATH = "/confirm?continue=true";
export const CONFIRM_FAILURE_PATH = "/login?error=confirm";

const CONFIRM_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "signup",
]);

export function isConfirmOtpType(
  value: string | null | undefined,
): value is EmailOtpType {
  return Boolean(value && CONFIRM_OTP_TYPES.has(value as EmailOtpType));
}

export function confirmContinuationCookieValue(
  value: string | null | undefined,
): string | null {
  return safeInvitationContinuation(value);
}
