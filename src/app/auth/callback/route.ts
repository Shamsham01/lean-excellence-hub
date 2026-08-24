import { NextResponse } from "next/server";

import {
  isEnabledOAuthProvider,
  isVerifiedOAuthIdentity,
} from "@/modules/identity/oauth";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const provider = url.searchParams.get("provider");

  if (!code || !provider || !isEnabledOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  const user = await supabase.auth.getUser();
  if (
    user.error ||
    !user.data.user ||
    !isVerifiedOAuthIdentity(provider, user.data.user)
  ) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  await routeAfterAuthentication();
}
