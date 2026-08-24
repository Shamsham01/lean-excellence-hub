"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  const description = String(formData.get("description") ?? "").trim();
  await supabase.rpc("create_action", {
    target_title: title,
    ...(description ? { target_description: description } : {}),
    target_priority: "normal",
  });
  revalidatePath("/platform/actions");
}
