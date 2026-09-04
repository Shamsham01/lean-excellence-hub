import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { emailPasswordSchema } from "@/modules/identity/auth-input";
import { resolveEmailPasswordLoginRedirectPath } from "@/modules/identity/email-login";
import {
  buildCanonicalRedirectUrl,
  requestHasTrustedOrigin,
} from "@/platform/application-origin";
import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import { recordAuthenticationSecurityEvent } from "@/platform/supabase/secret";
import type { Database } from "@/platform/supabase/database.types";

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

  const publicEnvironment = getPublicEnvironment();
  const supabase = createServerClient<Database>(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
