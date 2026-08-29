import { NextResponse } from "next/server";

import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
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

  return NextResponse.redirect(new URL(loginPath, request.url), {
    status: 303,
  });
}
