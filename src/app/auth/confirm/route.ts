import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { routeAfterAuthentication } from "@/modules/identity/session";
import { finaliseIdentityEnrolment } from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/update-password", url.origin));
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }

  const finalised = await finaliseIdentityEnrolment(userId);
  if (finalised.error) {
    return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
  }
  await routeAfterAuthentication();
}
