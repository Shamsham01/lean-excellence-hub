export const RECOVERY_OTP_TYPE = "recovery" as const;
export const RECOVERY_FAILURE_PATH = "/recover?error=expired";
export const RECOVERY_STAGED_PATH = "/recover?continue=true";
export const RECOVERY_SUCCESS_PATH = "/update-password";
export const RECOVERY_TOKEN_COOKIE = "leh_recovery_token_hash";
export const RECOVERY_CODE_COOKIE = "leh_recovery_code";
export const RECOVERY_INTENT_MAX_AGE_SECONDS = 10 * 60;

export type RecoveryCallbackParams = {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
};

export type RecoveryCallbackIntent =
  | { kind: "verify_otp"; tokenHash: string }
  | { kind: "exchange_code"; code: string }
  | { kind: "invalid" };

export function resolveRecoveryCallbackIntent(
  params: RecoveryCallbackParams,
): RecoveryCallbackIntent {
  const tokenHash = params.tokenHash?.trim() || null;
  const code = params.code?.trim() || null;
  const type = params.type?.trim() || null;

  if (type && type !== RECOVERY_OTP_TYPE) {
    return { kind: "invalid" };
  }

  if (tokenHash) {
    if (type !== RECOVERY_OTP_TYPE) {
      return { kind: "invalid" };
    }
    return { kind: "verify_otp", tokenHash };
  }

  if (code) {
    return { kind: "exchange_code", code };
  }

  return { kind: "invalid" };
}

export function recoveryForwardSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const forwarded = new URLSearchParams();
  const tokenHash = searchParams.get("token_hash")?.trim();
  const code = searchParams.get("code")?.trim();

  if (tokenHash) {
    forwarded.set("token_hash", tokenHash);
  }
  if (code) {
    forwarded.set("code", code);
  }
  forwarded.set("type", RECOVERY_OTP_TYPE);
  return forwarded;
}
