import { NextResponse } from "next/server";

import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { buildCanonicalRedirectUrl } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const formData = await request.formData();
  const nextValue = formData.get("next");
  const invitationContinuation = safeInvitationContinuation(
    typeof nextValue === "string" ? nextValue : null,
  );
  const genericNext = safeRelativeRedirect(
    typeof nextValue === "string" ? nextValue : null,
    "/login",
  );
  const loginPath =
    invitationContinuation !== null
      ? `/login?next=${encodeURIComponent(invitationContinuation)}`
      : genericNext === "/login"
        ? "/login"
        : `/login?next=${encodeURIComponent(genericNext)}`;

  return NextResponse.redirect(
    buildCanonicalRedirectUrl(loginPath, getServerEnvironment()),
    {
      status: 303,
    },
  );
}
