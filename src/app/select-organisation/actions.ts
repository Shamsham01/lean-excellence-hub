"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { switchOrganisation } from "@/modules/organisations/context";

export async function selectOrganisation(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("organisationId"));
  if (!parsed.success) {
    redirect("/select-organisation?error=invalid");
  }

  try {
    await switchOrganisation(parsed.data);
  } catch {
    redirect("/select-organisation?error=invalid");
  }
  redirect("/");
}
