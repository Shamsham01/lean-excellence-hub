"use server";

import { revalidatePath } from "next/cache";

import { assertPlatformNotificationTargetAccessible } from "@/modules/platform-shell/notification-target-access";
import { resolvePlatformInAppNotificationHref } from "@/modules/platform-shell/notification-target";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type OpenInAppNotificationResult =
  { ok: true; href: string } | { ok: false; message: string };

export async function openInAppNotification(
  notificationId: string,
): Promise<OpenInAppNotificationResult> {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from("in_app_notifications")
    .select("id, href, notification_type, dedupe_key, read_at")
    .eq("id", notificationId)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      message: "This notification is no longer available.",
    };
  }

  const href = resolvePlatformInAppNotificationHref(row);
  if (!href) {
    return {
      ok: false,
      message:
        "We could not open this notification. It may have been archived.",
    };
  }

  const access = await assertPlatformNotificationTargetAccessible(
    supabase,
    href,
  );
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  if (!row.read_at) {
    const { error: markError } = await supabase.rpc(
      "mark_in_app_notification_read",
      {
        target_notification_id: notificationId,
      },
    );
    if (markError) {
      return { ok: false, message: markError.message };
    }
  }

  revalidatePath("/platform");
  return { ok: true, href };
}

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
