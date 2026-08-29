"use server";

import { redirect } from "next/navigation";

import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function acceptInvitationSignupBinding(bindingId: string) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.refreshSession();
  const { data, error } = await supabase.rpc(
    "accept_organisation_invitation_signup_binding",
    {
      target_binding_id: bindingId,
    },
  );

  if (error || !data) {
    throw new Error("Invitation is unavailable.");
  }

  return data as string;
}

export async function acceptBinding(formData: FormData) {
  const bindingId = formData.get("bindingId");
  if (typeof bindingId !== "string") {
    redirect("/login");
  }

  try {
    await acceptInvitationSignupBinding(bindingId);
  } catch {
    redirect(
      `/invitations/continue/${encodeURIComponent(bindingId)}?accept_error=1`,
    );
  }

  await routeAfterAuthentication();
}
