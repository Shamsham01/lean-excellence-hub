import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  invitationContinuePath,
  isInvitationSignupBindingId,
} from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import {
  normalizeApplicationOrigin,
  resolveApplicationOrigin,
} from "@/platform/application-origin";
import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import { finaliseIdentityEnrolment } from "@/platform/supabase/secret";
import type { Database } from "@/platform/supabase/database.types";

const OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

async function resolvePostConfirmRedirect(
  supabase: Awaited<ReturnType<typeof createServerClient<Database>>>,
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
    return "/no-access";
  }

  if (eligible.length === 1) {
    await supabase.rpc("switch_organisation", {
      target_organisation_id: eligible[0]!.organisation_id,
    });
    return "/platform";
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

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const redirectOrigin = resolveConfirmRedirectOrigin(request);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(
      new URL("/login?error=confirm", redirectOrigin),
      {
        status: 303,
      },
    );
  }

  let redirectPath = "/login?error=confirm";
  const response = NextResponse.redirect(
    new URL(redirectPath, redirectOrigin),
    { status: 303 },
  );

  const environment = getPublicEnvironment();
  const supabase = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (!error) {
    if (type === "recovery") {
      redirectPath = "/update-password";
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (userId) {
        const finalised = await finaliseIdentityEnrolment(userId);
        if (!finalised.error) {
          const metadataBinding =
            typeof userData.user?.user_metadata?.invitation_signup_binding ===
            "string"
              ? userData.user.user_metadata.invitation_signup_binding
              : null;

          redirectPath = await resolvePostConfirmRedirect(
            supabase,
            metadataBinding,
            url.searchParams.get("next"),
          );
        }
      }
    }
  }

  response.headers.set(
    "Location",
    new URL(redirectPath, redirectOrigin).toString(),
  );
  return response;
}
