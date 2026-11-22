import { type NextRequest, NextResponse } from "next/server";

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
      { error: "Unable to sign out." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const response = NextResponse.redirect(
    buildCanonicalRedirectUrl("/org_admin/login", environment),
    { status: 303 },
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  const supabase = createRouteHandlerSupabaseClient(request, response);
  await supabase.auth.signOut();
  return response;
}
