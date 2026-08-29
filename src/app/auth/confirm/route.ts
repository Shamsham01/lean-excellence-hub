import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { routeAfterAuthentication } from "@/modules/identity/session";
import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { getPublicEnvironment } from "@/platform/env";
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

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function applyCookies(response: NextResponse, pendingCookies: PendingCookie[]) {
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  const pendingCookies: PendingCookie[] = [];
  const environment = getPublicEnvironment();
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  if (type === "recovery") {
    return applyCookies(
      NextResponse.redirect(new URL("/update-password", url.origin)),
      pendingCookies,
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  const finalised = await finaliseIdentityEnrolment(userId);
  if (finalised.error) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  const metadataContinuation =
    typeof userData.user?.user_metadata?.invitation_continue === "string"
      ? userData.user.user_metadata.invitation_continue
      : null;
  const queryContinuation = safeRelativeRedirect(
    url.searchParams.get("next"),
    "",
  );
  const continuation = safeInvitationContinuation(
    metadataContinuation || queryContinuation || null,
  );

  if (continuation) {
    return applyCookies(
      NextResponse.redirect(new URL(continuation, url.origin)),
      pendingCookies,
    );
  }

  await routeAfterAuthentication();
}
