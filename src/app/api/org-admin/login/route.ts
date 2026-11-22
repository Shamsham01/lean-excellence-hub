import { type NextRequest, NextResponse } from "next/server";

import { emailPasswordSchema } from "@/modules/identity/auth-input";
import { decidePlatformAdminAccess } from "@/modules/platform-admin/access-decision";
import {
  platformAdminIdentityActive,
  recordPlatformAdminAccess,
} from "@/modules/platform-admin/data";
import { consumePlatformLoginRateLimit } from "@/modules/platform-admin/gate";
import {
  buildCanonicalRedirectUrl,
  requestHasTrustedOrigin,
} from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

function redirectTo(path: string) {
  const response = NextResponse.redirect(
    buildCanonicalRedirectUrl(path, getServerEnvironment()),
    { status: 303 },
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!requestHasTrustedOrigin(request, environment)) {
    return NextResponse.json(
      { error: "Unable to sign in with those credentials." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const formData = await request.formData();
  const parsed = emailPasswordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const failure = redirectTo("/org_admin/login?error=invalid");
  if (!parsed.success) {
    return failure;
  }

  const withinLimit = await consumePlatformLoginRateLimit(parsed.data.email);
  if (!withinLimit) {
    await recordPlatformAdminAccess({
      action: "login.attempt",
      actorUserId: null,
      outcome: "rate_limited",
      requestPath: "/org_admin/login",
    });
    return redirectTo("/org_admin/login?error=limited");
  }

  const supabase = createRouteHandlerSupabaseClient(request, failure);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await recordPlatformAdminAccess({
      action: "login.attempt",
      actorUserId: null,
      outcome: "denied",
      requestPath: "/org_admin/login",
    });
    return failure;
  }

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  const allowlisted = userId
    ? await platformAdminIdentityActive(userId)
    : false;
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const decision = decidePlatformAdminAccess({
    allowlisted,
    assuranceLevel: assurance.data?.currentLevel === "aal2" ? "aal2" : "aal1",
    rateLimited: false,
    userId,
  });
  await recordPlatformAdminAccess({
    action: "login.attempt",
    actorUserId: userId,
    outcome:
      decision === "allowed"
        ? "allowed"
        : decision === "mfa"
          ? "mfa_required"
          : "denied",
    requestPath: "/org_admin/login",
  });

  failure.headers.set(
    "Location",
    buildCanonicalRedirectUrl("/org_admin", environment).toString(),
  );
  return failure;
}
