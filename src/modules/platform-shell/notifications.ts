import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export type PlatformInAppNotification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
  notification_type: string;
};

export type PlatformNotificationSnapshot = {
  unreadCount: number;
  items: PlatformInAppNotification[];
};

export async function loadPlatformNotificationSnapshot(
  membershipId: string,
): Promise<PlatformNotificationSnapshot | null> {
  const supabase = await createServerSupabaseClient();

  const syncResult = await supabase.rpc(
    "sync_leanai_operational_chase_notifications",
  );
  if (syncResult.error) {
    const legacySync = await supabase.rpc(
      "sync_overdue_action_chase_notifications",
    );
    if (legacySync.error) {
      /* Migration may not be applied on older databases; ignore and continue. */
    }
  }

  const [{ count, error: countError }, { data: rows, error: listError }] =
    await Promise.all([
      supabase
        .from("in_app_notifications")
        .select("id", { count: "exact", head: true })
        .eq("membership_id", membershipId)
        .is("read_at", null),
      supabase
        .from("in_app_notifications")
        .select("id, title, body, href, read_at, created_at, notification_type")
        .eq("membership_id", membershipId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (countError || listError) {
    return null;
  }

  return {
    unreadCount: count ?? 0,
    items: (rows ?? []) as PlatformInAppNotification[],
  };
}
