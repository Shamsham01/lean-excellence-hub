import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  CONFIRM_FAILURE_PATH,
  CONFIRM_INTENT_MAX_AGE_SECONDS,
  CONFIRM_NEXT_COOKIE,
  CONFIRM_STAGED_PATH,
  CONFIRM_TOKEN_COOKIE,
  CONFIRM_TYPE_COOKIE,
  confirmContinuationCookieValue,
  isConfirmOtpType,
} from "@/modules/identity/confirm-callback";
import {
  invitationContinuePath,
  isInvitationSignupBindingId,
} from "@/modules/identity/invitation-constants";
import {
  RECOVERY_OTP_TYPE,
  recoveryForwardSearchParams,
} from "@/modules/identity/recovery-callback";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  buildCanonicalRedirectUrl,
  normalizeApplicationOrigin,
  requestHasTrustedOrigin,
  resolveApplicationOrigin,
} from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import {
  finaliseFoundingSignup,
  finaliseIdentityEnrolment,
} from "@/platform/supabase/secret";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";
import type { Database } from "@/platform/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ConfirmSupabaseClient = SupabaseClient<Database>;

async function resolvePostConfirmRedirect(
  supabase: ConfirmSupabaseClient,
  metadataBinding: string | null,
  queryNext: string | null,
) {
  if (isInvitationSignupBindingId(metadataBinding)) {
    return invitationContinuePath(metadataBinding);
  }

  const queryContinuation = safeRelativeRedirect(queryNext, "");
  if (
    queryContinuation.startsWith("/invitations/continue/") &&
    isInvitationSignupBindingId(
      queryContinuation.replace("/invitations/continue/", ""),
    )
  ) {
    return queryContinuation;
  }

  const identity = await supabase.rpc("current_identity_state");
  const state = identity.data?.[0] as
    | {
        identity_status?: string;
        password_change_required?: boolean;
      }
    | undefined;

  if (identity.error || state?.identity_status !== "active") {
    return "/no-access";
  }

  if (state.password_change_required) {
    return "/update-password";
  }

  const organisations = await supabase.rpc("list_my_eligible_organisations");
  const eligible = organisations.data ?? [];

  if (eligible.length === 0) {
    const founding = await supabase.rpc("current_can_found_organisation");
    if (founding.data === true) {
      return "/create-organisation";
    }
    return "/no-access";
  }

  if (eligible.length === 1) {
    await supabase.rpc("switch_organisation", {
      target_organisation_id: eligible[0]!.organisation_id,
    });
    return pathForOrganisationStatus(
      eligible[0]!.organisation_status,
      eligible[0]!.onboarding_required,
    );
  }

  return "/select-organisation";
}

function resolveConfirmRedirectOrigin(request: NextRequest) {
  const originResult = resolveApplicationOrigin({
    requestHeaders: request.headers,
  });
  if (originResult.ok) {
    return originResult.origin;
  }

  return normalizeApplicationOrigin(getServerEnvironment().APP_ORIGIN);
}

function canonicalConfirmRedirect(path: string) {
  return NextResponse.redirect(
    buildCanonicalRedirectUrl(path, getServerEnvironment()),
    { status: 303 },
  );
}

function confirmCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    maxAge: CONFIRM_INTENT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

function clearConfirmIntentCookies(response: NextResponse, secure: boolean) {
  const options = {
    ...confirmCookieOptions(secure),
    maxAge: 0,
  };
  response.cookies.set(CONFIRM_TOKEN_COOKIE, "", options);
  response.cookies.set(CONFIRM_TYPE_COOKIE, "", options);
  response.cookies.set(CONFIRM_NEXT_COOKIE, "", options);
}

function forwardRecoveryCallback(request: NextRequest) {
  const target = buildCanonicalRedirectUrl(
    "/auth/recovery",
    getServerEnvironment(),
  );
  recoveryForwardSearchParams(request.nextUrl.searchParams).forEach(
    (value, key) => {
      target.searchParams.set(key, value);
    },
  );
  return NextResponse.redirect(target, { status: 303 });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const type = url.searchParams.get("type");

  if (type === RECOVERY_OTP_TYPE) {
    return forwardRecoveryCallback(request);
  }

  const redirectOrigin = resolveConfirmRedirectOrigin(request);
  const tokenHash = url.searchParams.get("token_hash")?.trim() ?? "";

  if (!tokenHash || !isConfirmOtpType(type)) {
    return NextResponse.redirect(
      new URL(CONFIRM_FAILURE_PATH, redirectOrigin),
      { status: 303 },
    );
  }

  // Do not verify or enrol on GET. Mail scanners prefetch links and would
  // otherwise consume the single-use signup token before the person opens it.
  const response = NextResponse.redirect(
    new URL(CONFIRM_STAGED_PATH, redirectOrigin),
    { status: 303 },
  );
  const secure = getServerEnvironment().NODE_ENV === "production";
  const options = confirmCookieOptions(secure);
  response.cookies.set(CONFIRM_TOKEN_COOKIE, tokenHash, options);
  response.cookies.set(CONFIRM_TYPE_COOKIE, type, options);

  const continuation = confirmContinuationCookieValue(
    url.searchParams.get("next"),
  );
  if (continuation) {
    response.cookies.set(CONFIRM_NEXT_COOKIE, continuation, options);
  } else {
    response.cookies.set(CONFIRM_NEXT_COOKIE, "", { ...options, maxAge: 0 });
  }

  return response;
}

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  const secure = environment.NODE_ENV === "production";
  const response = canonicalConfirmRedirect(CONFIRM_FAILURE_PATH);

  if (!requestHasTrustedOrigin(request, environment)) {
    clearConfirmIntentCookies(response, secure);
    return response;
  }

  const tokenHash = request.cookies.get(CONFIRM_TOKEN_COOKIE)?.value ?? "";
  const type = request.cookies.get(CONFIRM_TYPE_COOKIE)?.value ?? null;
  const stagedNext = request.cookies.get(CONFIRM_NEXT_COOKIE)?.value ?? null;
  clearConfirmIntentCookies(response, secure);

  if (!tokenHash || !isConfirmOtpType(type)) {
    return response;
  }

  const supabase = createRouteHandlerSupabaseClient(request, response);
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return response;
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    await supabase.auth.signOut({ scope: "local" });
    return response;
  }

  const finalised = await finaliseIdentityEnrolment(userId);
  if (finalised.error) {
    return response;
  }

  const foundingBinding =
    typeof userData.user?.user_metadata?.founding_signup_binding === "string"
      ? userData.user.user_metadata.founding_signup_binding
      : null;
  if (foundingBinding) {
    await finaliseFoundingSignup(foundingBinding, userId);
  }

  const metadataBinding =
    typeof userData.user?.user_metadata?.invitation_signup_binding === "string"
      ? userData.user.user_metadata.invitation_signup_binding
      : null;

  const redirectPath = await resolvePostConfirmRedirect(
    supabase,
    metadataBinding,
    stagedNext,
  );

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(redirectPath, environment).toString(),
  );
  return response;
}
