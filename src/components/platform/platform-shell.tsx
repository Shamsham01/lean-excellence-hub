import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
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

async function canAccessSetupNavigation() {
  const setupPermissions = [
    "hierarchy.manage",
    "invitations.manage",
    "memberships.manage",
  ];

  for (const permission of setupPermissions) {
    if (await currentMemberHasPermission(permission)) {
      return true;
    }
  }

  return false;
}

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
    for (const permission of platformHomeFallbackPermissions) {
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
    ...visibleNav.filter((item) => item.href !== "/platform/setup"),
  ];

  if (await canAccessSetupNavigation()) {
    navWithSetup.unshift(setupNavigationItem);
  }

  if (
    settingsNavigationItem.universalAccess &&
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
