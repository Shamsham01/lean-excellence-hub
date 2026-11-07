import type { ReactNode } from "react";

import { PlatformConsoleShell } from "@/components/platform-admin/console-shell";
import { enforcePlatformConsole } from "@/modules/platform-admin/console-route";
import { loadPlatformAdminInAppSnapshot } from "@/modules/platform-admin/data";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export default async function PlatformConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestPath = await readRequestPathname();
  const access = await resolvePlatformConsoleAccess();
  enforcePlatformConsole(access);
  const pathname = requestPath ?? "/org_admin";
  const inAppNotifications = await loadPlatformAdminInAppSnapshot({
    requestPath,
    userId: access.userId,
  }).catch(() => null);

  return (
    <PlatformConsoleShell
      inAppNotifications={inAppNotifications}
      pathname={pathname}
    >
      {children}
    </PlatformConsoleShell>
  );
}
