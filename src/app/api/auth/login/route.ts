import { type NextRequest, NextResponse } from "next/server";

import { emailPasswordSchema } from "@/modules/identity/auth-input";
import { resolveEmailPasswordLoginRedirectPath } from "@/modules/identity/email-login";
import {
  buildCanonicalRedirectUrl,
  requestHasTrustedOrigin,
} from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { recordAuthenticationSecurityEvent } from "@/platform/supabase/secret";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!requestHasTrustedOrigin(request, environment)) {
    return NextResponse.json(
      { error: "Unable to sign in with those credentials." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const parsed = emailPasswordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  let redirectPath = "/login?error=invalid";
  const response = NextResponse.redirect(
    buildCanonicalRedirectUrl(redirectPath, environment),
    { status: 303 },
  );

  const supabase = createRouteHandlerSupabaseClient(request, response);

  if (!parsed.success) {
    await recordAuthenticationSecurityEvent(
      "authentication.email_password",
      "denied",
    );
    return response;
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await recordAuthenticationSecurityEvent(
      "authentication.email_password",
      "denied",
    );
    return response;
  }

  await recordAuthenticationSecurityEvent(
    "authentication.email_password",
    "succeeded",
  );

  const nextValue = formData.get("next");
  const next = typeof nextValue === "string" ? nextValue : null;
  redirectPath = await resolveEmailPasswordLoginRedirectPath(supabase, next);

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(redirectPath, environment).toString(),
  );
  return response;
}
