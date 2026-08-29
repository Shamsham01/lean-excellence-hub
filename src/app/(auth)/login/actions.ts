"use server";

import { redirect } from "next/navigation";

import { emailPasswordSchema } from "@/modules/identity/auth-input";
import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { recordAuthenticationSecurityEvent } from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function login(formData: FormData) {
  const parsed = emailPasswordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    await recordAuthenticationSecurityEvent(
      "authentication.email_password",
      "denied",
    );
    redirect("/login?error=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await recordAuthenticationSecurityEvent(
      "authentication.email_password",
      "denied",
    );
    redirect("/login?error=invalid");
  }

  await recordAuthenticationSecurityEvent(
    "authentication.email_password",
    "succeeded",
  );
  const next = safeRelativeRedirect(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null,
  );
  const identity = await supabase.rpc("current_identity_state");
  if (identity.data?.[0]?.password_change_required) {
    redirect("/update-password");
  }
  const invitationContinuation = safeInvitationContinuation(next);
  if (invitationContinuation) {
    redirect(invitationContinuation);
  }

  await routeAfterAuthentication();
}
