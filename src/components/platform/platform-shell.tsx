import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { platformNavigation } from "@/modules/platform-shell/navigation";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import type { EligibleOrganisation } from "@/modules/organisations/context";

type PlatformShellProps = {
  children: ReactNode;
  organisationName: string;
  organisations: EligibleOrganisation[];
};

export async function PlatformShell({
  children,
  organisationName,
  organisations,
}: PlatformShellProps) {
  const visibleNav = [];
  for (const item of platformNavigation) {
    if (await currentMemberHasPermission(item.permission)) {
      visibleNav.push(item);
    }
  }

  // Home requires maturity.read; fallback if only actions.read
  if (
    visibleNav.length === 0 ||
    !visibleNav.some((i) => i.href === "/platform")
  ) {
    if (await currentMemberHasPermission("actions.read")) {
      visibleNav.unshift({
        href: "/platform",
        label: "Home",
        permission: "actions.read",
        section: "main" as const,
      });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <PlatformSidebar
        items={visibleNav}
        organisationName={organisationName}
        organisations={organisations}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
