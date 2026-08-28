import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import {
  platformNavigation,
  settingsNavigationItem,
  setupNavigationItem,
} from "@/modules/platform-shell/navigation";
import {
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
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
    const canAccess = item.organisationScopeOnly
      ? await currentMemberHasScopedPermission(item.permission)
      : await currentMemberHasPermission(item.permission);
    if (canAccess) {
      visibleNav.push(item);
    }
  }

  // Home requires maturity.read; fallback if only actions.read
  if (
    visibleNav.length === 0 ||
    !visibleNav.some((i) => i.href === "/platform")
  ) {
    const homePermissions = [
      "actions.read",
      "five_s.read",
      "gemba.read",
      "schedules.read",
      "people.capability.read",
      "training.read",
      "skills.read",
      "suggestions.read",
      "recognition.read",
    ];
    for (const permission of homePermissions) {
      if (await currentMemberHasPermission(permission)) {
        visibleNav.unshift({
          href: "/platform",
          label: "Home",
          permission,
          section: "main" as const,
        });
        break;
      }
    }
  }

  const navWithSetup = [
    setupNavigationItem,
    ...visibleNav.filter((item) => item.href !== "/platform/setup"),
  ];

  const canAccessSettings = true;

  if (
    canAccessSettings &&
    !navWithSetup.some((item) => item.href === "/platform/settings")
  ) {
    navWithSetup.push(settingsNavigationItem);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <PlatformSidebar
        items={navWithSetup}
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
