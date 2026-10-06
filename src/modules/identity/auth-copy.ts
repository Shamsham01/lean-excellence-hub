export const AUTH_COPY = {
  loginInvalid:
    "Unable to sign in. Check your email and password. If you've used Lean Excellence Hub before and can't remember your password, reset it.",
  loginConfirm:
    "This confirmation link is invalid or has expired. Sign in, or reset your password if you already have an account.",
  loginCallback:
    "Sign in could not be completed. Try email and password, or reset your password.",
  recoverDescription:
    "We'll send recovery instructions if an eligible account exists.",
  recoverSent:
    "If an eligible account exists, recovery instructions have been sent.",
  recoverExpired:
    "This recovery link is invalid or has expired. Request a new password reset email.",
  updatePasswordWeak:
    "Choose a stronger password. Use at least 12 characters with upper and lower case letters, a number, and a symbol.",
  updatePasswordFailed:
    "The password could not be updated. Try again, or request a new recovery email if you were resetting access.",
  updatePasswordSession:
    "Your recovery session is missing or has expired. Request a new password reset email, or sign in if you already know your password.",
} as const;

export function loginErrorCopy(
  error: string | undefined,
): (typeof AUTH_COPY)[keyof typeof AUTH_COPY] {
  if (error === "confirm") {
    return AUTH_COPY.loginConfirm;
  }
  if (error === "callback") {
    return AUTH_COPY.loginCallback;
  }
  return AUTH_COPY.loginInvalid;
}
