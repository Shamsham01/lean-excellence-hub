import { type NextRequest, NextResponse } from "next/server";

import {
  RECOVERY_CODE_COOKIE,
  RECOVERY_FAILURE_PATH,
  RECOVERY_INTENT_MAX_AGE_SECONDS,
  RECOVERY_OTP_TYPE,
  RECOVERY_STAGED_PATH,
  RECOVERY_SUCCESS_PATH,
  RECOVERY_TOKEN_COOKIE,
  resolveRecoveryCallbackIntent,
} from "@/modules/identity/recovery-callback";
import {
  buildCanonicalRedirectUrl,
  requestHasTrustedOrigin,
} from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

function canonicalRecoveryRedirect(path: string) {
  return NextResponse.redirect(
    buildCanonicalRedirectUrl(path, getServerEnvironment()),
    { status: 303 },
  );
}

function recoveryCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    maxAge: RECOVERY_INTENT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

function clearRecoveryIntentCookies(
  response: NextResponse,
  secure: boolean,
): void {
  const options = {
    ...recoveryCookieOptions(secure),
    maxAge: 0,
  };
  response.cookies.set(RECOVERY_TOKEN_COOKIE, "", options);
  response.cookies.set(RECOVERY_CODE_COOKIE, "", options);
}

export async function GET(request: NextRequest) {
  const environment = getServerEnvironment();
  const intent = resolveRecoveryCallbackIntent({
    tokenHash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
    code: request.nextUrl.searchParams.get("code"),
  });

  if (intent.kind === "invalid") {
    return canonicalRecoveryRedirect(RECOVERY_FAILURE_PATH);
  }

  // Do not consume the one-time recovery token on GET. Enterprise mail
  // scanners commonly prefetch links and would otherwise burn the token
  // before the human opens the message. Stage it in a short-lived HttpOnly
  // cookie, strip it from the browser URL, and require an explicit POST.
  const response = canonicalRecoveryRedirect(RECOVERY_STAGED_PATH);
  const options = recoveryCookieOptions(environment.NODE_ENV === "production");

  if (intent.kind === "verify_otp") {
    response.cookies.set(RECOVERY_TOKEN_COOKIE, intent.tokenHash, options);
    response.cookies.set(RECOVERY_CODE_COOKIE, "", { ...options, maxAge: 0 });
  } else {
    response.cookies.set(RECOVERY_CODE_COOKIE, intent.code, options);
    response.cookies.set(RECOVERY_TOKEN_COOKIE, "", { ...options, maxAge: 0 });
  }

  return response;
}

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  const secure = environment.NODE_ENV === "production";
  const response = canonicalRecoveryRedirect(RECOVERY_FAILURE_PATH);

  if (!requestHasTrustedOrigin(request, environment)) {
    clearRecoveryIntentCookies(response, secure);
    return response;
  }

  const tokenHash = request.cookies.get(RECOVERY_TOKEN_COOKIE)?.value ?? null;
  const code = request.cookies.get(RECOVERY_CODE_COOKIE)?.value ?? null;
  const intent = resolveRecoveryCallbackIntent({
    tokenHash,
    type: tokenHash ? RECOVERY_OTP_TYPE : null,
    code,
  });

  clearRecoveryIntentCookies(response, secure);

  if (intent.kind === "invalid") {
    return response;
  }

  const supabase = createRouteHandlerSupabaseClient(request, response);

  if (intent.kind === "verify_otp") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: intent.tokenHash,
      type: RECOVERY_OTP_TYPE,
    });
    if (error) {
      return response;
    }
  } else {
    const { error } = await supabase.auth.exchangeCodeForSession(intent.code);
    if (error) {
      return response;
    }
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    await supabase.auth.signOut({ scope: "local" });
    return response;
  }

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(RECOVERY_SUCCESS_PATH, environment).toString(),
  );
  return response;
}
