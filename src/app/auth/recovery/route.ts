import { type NextRequest, NextResponse } from "next/server";

import {
  RECOVERY_FAILURE_PATH,
  RECOVERY_OTP_TYPE,
  RECOVERY_SUCCESS_PATH,
  resolveRecoveryCallbackIntent,
} from "@/modules/identity/recovery-callback";
import { buildCanonicalRedirectUrl } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

function canonicalRecoveryRedirect(path: string) {
  return NextResponse.redirect(
    buildCanonicalRedirectUrl(path, getServerEnvironment()),
    { status: 303 },
  );
}

export async function GET(request: NextRequest) {
  const environment = getServerEnvironment();
  const response = canonicalRecoveryRedirect(RECOVERY_FAILURE_PATH);

  const intent = resolveRecoveryCallbackIntent({
    tokenHash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
    code: request.nextUrl.searchParams.get("code"),
  });

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
