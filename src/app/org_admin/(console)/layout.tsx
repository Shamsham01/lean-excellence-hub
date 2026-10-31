import type { ReactNode } from "react";

import { PlatformConsoleShell } from "@/components/platform-admin/console-shell";
import { enforcePlatformConsole } from "@/modules/platform-admin/console-route";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export default async function PlatformConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await resolvePlatformConsoleAccess();
  enforcePlatformConsole(access);
  const pathname = (await readRequestPathname()) ?? "/org_admin";

  return (
    <PlatformConsoleShell pathname={pathname}>{children}</PlatformConsoleShell>
  );
}
