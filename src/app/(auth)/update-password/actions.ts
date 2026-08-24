"use server";

import { redirect } from "next/navigation";

import { passwordUpdateSchema } from "@/modules/identity/auth-input";
import { routeAfterAuthentication } from "@/modules/identity/session";
import {
  finaliseIdentityEnrolment,
  recordAuthenticationSecurityEvent,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function updatePassword(formData: FormData) {
  const parsed = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/update-password?error=weak");
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    await recordAuthenticationSecurityEvent(
      "authentication.password_changed",
      "failed",
    );
    redirect("/update-password?error=failed");
  }

  const finalised = await finaliseIdentityEnrolment(userId);
  if (finalised.error || finalised.data !== true) {
    await recordAuthenticationSecurityEvent(
      "authentication.password_changed",
      "failed",
    );
    redirect("/update-password?error=failed");
  }

  await routeAfterAuthentication();
}
