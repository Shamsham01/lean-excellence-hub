import { NextResponse } from "next/server";

import {
  isEnabledOAuthProvider,
  isVerifiedOAuthIdentity,
} from "@/modules/identity/oauth";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { buildCanonicalRedirectUrl } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const provider = url.searchParams.get("provider");
  const redirectOrigin = getServerEnvironment();

  if (!code || !provider || !isEnabledOAuthProvider(provider)) {
    return NextResponse.redirect(
      buildCanonicalRedirectUrl("/login?error=callback", redirectOrigin),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      buildCanonicalRedirectUrl("/login?error=callback", redirectOrigin),
    );
  }

  const user = await supabase.auth.getUser();
  if (
    user.error ||
    !user.data.user ||
    !isVerifiedOAuthIdentity(provider, user.data.user)
  ) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      buildCanonicalRedirectUrl("/login?error=callback", redirectOrigin),
    );
  }

  await routeAfterAuthentication();
}
