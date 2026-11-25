import "server-only";

import {
  collapseChaseDigestNotifications,
  collapseChaseDigestUnreadCount,
} from "@/modules/platform-shell/notification-presentation";
import { resolvePlatformInAppNotificationHref } from "@/modules/platform-shell/notification-target";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type PlatformInAppNotification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
  notification_type: string;
  dedupe_key: string;
};

export type PlatformNotificationSnapshot = {
  unreadCount: number;
  items: PlatformInAppNotification[];
};

const CHASE_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const chaseSyncByMembership = new Map<
  string,
  { startedAt: number; promise: Promise<void> }
>();

// Process-local throttle: only the sync attempt is shared, never notification
// data. Keep the membership key so an organisation switch cannot reuse a
// different membership's sync state.
function syncChaseNotifications(
  membershipId: string,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<void> {
  const now = Date.now();
  const existing = chaseSyncByMembership.get(membershipId);
  if (existing && now - existing.startedAt < CHASE_SYNC_INTERVAL_MS) {
    return existing.promise;
  }

  for (const [key, entry] of chaseSyncByMembership) {
    if (now - entry.startedAt >= CHASE_SYNC_INTERVAL_MS) {
      chaseSyncByMembership.delete(key);
    }
  }

  const promise = (async () => {
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
  })();
  chaseSyncByMembership.set(membershipId, { startedAt: now, promise });
  return promise;
}

export async function loadPlatformNotificationSnapshot(
  membershipId: string,
): Promise<PlatformNotificationSnapshot | null> {
  const supabase = await createServerSupabaseClient();

  await syncChaseNotifications(membershipId, supabase);

  const [{ count, error: countError }, { data: rows, error: listError }] =
    await Promise.all([
      supabase
        .from("in_app_notifications")
        .select("id", { count: "exact", head: true })
        .eq("membership_id", membershipId)
        .is("read_at", null),
      supabase
        .from("in_app_notifications")
        .select(
          "id, title, body, href, read_at, created_at, notification_type, dedupe_key",
        )
        .eq("membership_id", membershipId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (countError || listError) {
    return null;
  }

  const items = ((rows ?? []) as PlatformInAppNotification[]).map((row) => ({
    ...row,
    href: resolvePlatformInAppNotificationHref(row),
  }));

  return {
    unreadCount: collapseChaseDigestUnreadCount(items, count ?? 0),
    items: collapseChaseDigestNotifications(items),
  };
}
