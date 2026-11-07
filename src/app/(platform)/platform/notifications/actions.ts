"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function markInAppNotificationRead(notificationId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_in_app_notification_read", {
    target_notification_id: notificationId,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/platform");
  return { ok: true as const };
}

export async function markAllInAppNotificationsRead() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_all_in_app_notifications_read");
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/platform");
  return { ok: true as const };
}
