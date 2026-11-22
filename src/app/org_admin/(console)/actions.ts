"use server";

import { revalidatePath } from "next/cache";

import {
  markAllPlatformAdminInAppNotificationsRead,
  markPlatformAdminInAppNotificationRead,
} from "@/modules/platform-admin/data";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";

async function requirePlatformOperator() {
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  return access.userId;
}

export async function markPlatformOwnerInAppNotificationRead(
  notificationId: string,
) {
  const userId = await requirePlatformOperator();
  if (!userId) {
    return { ok: false as const };
  }
  const result = await markPlatformAdminInAppNotificationRead({
    notificationId,
    userId,
  });
  if (result.ok) {
    revalidatePath("/org_admin", "layout");
  }
  return result;
}

export async function markAllPlatformOwnerInAppNotificationsRead() {
  const userId = await requirePlatformOperator();
  if (!userId) {
    return { ok: false as const };
  }
  const result = await markAllPlatformAdminInAppNotificationsRead({ userId });
  if (result.ok) {
    revalidatePath("/org_admin", "layout");
  }
  return result;
}
