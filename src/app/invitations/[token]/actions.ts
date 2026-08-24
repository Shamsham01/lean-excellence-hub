"use server";

import { redirect } from "next/navigation";

import { acceptInvitation } from "@/modules/identity/invitations";
import { routeAfterAuthentication } from "@/modules/identity/session";

export async function accept(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string") {
    redirect("/login");
  }

  try {
    await acceptInvitation(token);
  } catch {
    redirect(`/invitations/${encodeURIComponent(token)}?error=unavailable`);
  }
  await routeAfterAuthentication();
}
