import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
import { loadPlatformShellMember } from "@/modules/platform-shell/member-context";
import {
  platformNavigation,
  settingsNavigationItem,
  setupNavigationItem,
  type PlatformNavItem,
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
  membershipId: string;
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

async function buildVisibleNavigation() {
  const visibleNav: PlatformNavItem[] = [];

  for (const item of platformNavigation) {
    const canAccess = item.organisationScopeOnly
      ? await currentMemberHasScopedPermission(item.permission)
      : await currentMemberHasPermission(item.permission);
    if (canAccess) {
      visibleNav.push(item);
    }
  }

  if (
    visibleNav.length === 0 ||
    !visibleNav.some((item) => item.href === "/platform")
  ) {
    for (const permission of platformHomeFallbackPermissions) {
      if (await currentMemberHasPermission(permission)) {
        visibleNav.unshift({
          href: "/platform",
          label: "Home",
          permission,
          icon: "home",
          section: "main",
        });
        break;
      }
    }
  }

  const navWithSetup = visibleNav.filter(
    (item) => item.href !== "/platform/setup",
  );

  if (await canAccessSetupNavigation()) {
    navWithSetup.unshift(setupNavigationItem);
  }

  return navWithSetup;
}

export async function PlatformShell({
  children,
  organisationName,
  organisations,
  membershipId,
}: PlatformShellProps) {
  const [navWithSetup, member] = await Promise.all([
    buildVisibleNavigation(),
    loadPlatformShellMember(membershipId),
  ]);

  const showSettings =
    settingsNavigationItem.universalAccess === true &&
    !navWithSetup.some((item) => item.href === settingsNavigationItem.href);

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <PlatformSidebar
        items={navWithSetup}
        organisationName={organisationName}
        organisations={organisations}
        member={member}
        showSettings={showSettings}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
