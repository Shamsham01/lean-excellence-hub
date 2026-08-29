"use server";

import { redirect } from "next/navigation";

import { acceptInvitation } from "@/modules/identity/invitations";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { INVITATION_TOKEN_PATTERN } from "@/modules/identity/invitation-constants";

export async function accept(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !INVITATION_TOKEN_PATTERN.test(token)) {
    redirect("/login");
  }

  try {
    await acceptInvitation(token);
  } catch {
    redirect(`/invitations/${encodeURIComponent(token)}?accept_error=1`);
  }
  await routeAfterAuthentication();
}
