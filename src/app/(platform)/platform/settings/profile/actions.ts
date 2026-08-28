"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function updateProfileDisplayName(displayName: string) {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (!userId) {
    return { error: "You must be signed in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", userId);

  if (error) {
    if (error.code === "42501") {
      return { error: "You are not authorised to update your profile." };
    }
    return { error: "Unable to update your profile." };
  }

  revalidatePath("/platform/settings/profile");
  revalidatePath("/platform/setup");
  revalidatePath("/platform/people");

  return { ok: true as const };
}
