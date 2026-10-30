import { type NextRequest, NextResponse } from "next/server";

import {
  invitationContinuePath,
  isInvitationSignupBindingId,
} from "@/modules/identity/invitation-constants";
import { replaceExpiredInvitationSignupBinding } from "@/modules/identity/invitations";
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
      { error: "Unable to continue this invitation right now." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const bindingId = formData.get("bindingId");
  let redirectPath = "/login";

  if (typeof bindingId === "string" && isInvitationSignupBindingId(bindingId)) {
    redirectPath = `${invitationContinuePath(bindingId)}?replace_error=1`;
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
    const replacementId = await replaceExpiredInvitationSignupBinding(
      bindingId,
      supabase,
    );
    redirectPath = invitationContinuePath(replacementId);
  } catch {
    redirectPath = `${invitationContinuePath(bindingId)}?replace_error=1`;
  }

  response.headers.set(
    "Location",
    buildCanonicalRedirectUrl(redirectPath, environment).toString(),
  );
  return response;
}
