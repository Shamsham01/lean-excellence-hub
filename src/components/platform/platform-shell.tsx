import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { platformNavigation } from "@/modules/platform-shell/navigation";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

type PlatformShellProps = {
  children: ReactNode;
  organisationName: string;
};

export async function PlatformShell({
  children,
  organisationName,
}: PlatformShellProps) {
  const visibleNav = [];
  for (const item of platformNavigation) {
    if (await currentMemberHasPermission(item.permission)) {
      visibleNav.push(item);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="border-b border-border bg-card lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:flex-col lg:items-stretch">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Lean Excellence Hub
            </p>
            <p className="mt-1 text-sm font-semibold">{organisationName}</p>
          </div>
          <form action="/auth/signout" method="post">
            <Button className="w-full" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
