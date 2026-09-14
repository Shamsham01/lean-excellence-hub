import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
import {
  platformNavigation,
  setupNavigationItem,
  type PlatformNavItem,
} from "@/modules/platform-shell/navigation";
import {
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";

const setupPermissions = [
  "hierarchy.manage",
  "invitations.manage",
  "memberships.manage",
] as const;

export async function canAccessSetupNavigation() {
  const results = await Promise.all(
    setupPermissions.map((permission) =>
      currentMemberHasPermission(permission),
    ),
  );
  return results.some(Boolean);
}

export async function buildVisibleNavigation() {
  const access = await Promise.all(
    platformNavigation.map(async (item) => {
      const canAccess = item.organisationScopeOnly
        ? await currentMemberHasScopedPermission(item.permission)
        : await currentMemberHasPermission(item.permission);
      return { item, canAccess };
    }),
  );

  const visibleNav: PlatformNavItem[] = access
    .filter((entry) => entry.canAccess)
    .map((entry) => entry.item);

  if (
    visibleNav.length === 0 ||
    !visibleNav.some((item) => item.href === "/platform")
  ) {
    const fallbackAccess = await Promise.all(
      platformHomeFallbackPermissions.map(async (permission) => ({
        permission,
        granted: await currentMemberHasPermission(permission),
      })),
    );
    const fallback = fallbackAccess.find((entry) => entry.granted);
    if (fallback) {
      visibleNav.unshift({
        href: "/platform",
        label: "Home",
        permission: fallback.permission,
        icon: "home",
        section: "main",
      });
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
