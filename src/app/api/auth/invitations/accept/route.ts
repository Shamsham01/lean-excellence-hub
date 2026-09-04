import { type NextRequest, NextResponse } from "next/server";

import { INVITATION_TOKEN_PATTERN } from "@/modules/identity/invitation-constants";
import { acceptInvitation } from "@/modules/identity/invitations";
import { resolvePostAuthenticationRedirectPath } from "@/modules/identity/session";
import {
  buildCanonicalRedirectUrl,
  requestHasTrustedOrigin,
} from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!requestHasTrustedOrigin(request, environment)) {
    return NextResponse.json(
      { error: "Unable to accept this invitation right now." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const token = formData.get("token");
  let redirectPath = "/login";

  if (typeof token === "string" && INVITATION_TOKEN_PATTERN.test(token)) {
    redirectPath = `/invitations/${encodeURIComponent(token)}?accept_error=1`;
  }

  const response = NextResponse.redirect(
    buildCanonicalRedirectUrl(redirectPath, environment),
    { status: 303 },
  );

  if (typeof token !== "string" || !INVITATION_TOKEN_PATTERN.test(token)) {
    response.headers.set(
      "Location",
      buildCanonicalRedirectUrl("/login", environment).toString(),
    );
    return response;
  }

  const supabase = createRouteHandlerSupabaseClient(request, response);

  try {
    await acceptInvitation(token, supabase);
    redirectPath = await resolvePostAuthenticationRedirectPath(supabase);
  } catch {
    redirectPath = `/invitations/${encodeURIComponent(token)}?accept_error=1`;
  }

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(redirectPath, environment).toString(),
  );
  return response;
}
