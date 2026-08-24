"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createTemplate(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("create_template_draft", {
    target_display_name: displayName,
    ...(String(formData.get("description") ?? "").trim()
      ? {
          target_description: String(formData.get("description")).trim(),
        }
      : {}),
  });
  revalidatePath("/platform/templates");
}
