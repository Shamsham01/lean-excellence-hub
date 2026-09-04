import { type NextRequest, NextResponse } from "next/server";

import { isInvitationSignupBindingId } from "@/modules/identity/invitation-constants";
import { acceptInvitationSignupBinding } from "@/modules/identity/invitations";
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
  const bindingId = formData.get("bindingId");
  let redirectPath = "/login";

  if (typeof bindingId === "string" && isInvitationSignupBindingId(bindingId)) {
    redirectPath = `/invitations/continue/${encodeURIComponent(bindingId)}?accept_error=1`;
  }

  const response = NextResponse.redirect(
    buildCanonicalRedirectUrl(redirectPath, environment),
    { status: 303 },
  );

  if (
    typeof bindingId !== "string" ||
    !isInvitationSignupBindingId(bindingId)
  ) {
    response.headers.set(
      "Location",
      buildCanonicalRedirectUrl("/login", environment).toString(),
    );
    return response;
  }

  const supabase = createRouteHandlerSupabaseClient(request, response);

  try {
    await acceptInvitationSignupBinding(bindingId, supabase);
    redirectPath = await resolvePostAuthenticationRedirectPath(supabase);
  } catch {
    redirectPath = `/invitations/continue/${encodeURIComponent(bindingId)}?accept_error=1`;
  }

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(redirectPath, environment).toString(),
  );
  return response;
}
