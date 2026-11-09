import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
import {
  platformNavigation,
  type PlatformNavItem,
} from "@/modules/platform-shell/navigation";

export const setupNavigationPermissions = [
  "hierarchy.manage",
  "invitations.manage",
  "memberships.manage",
] as const;

function collectNavigationPermissionKeys(
  selector: (item: PlatformNavItem) => readonly string[],
): string[] {
  return Array.from(new Set(platformNavigation.flatMap((item) => selector(item))));
}

export function collectPlatformShellPermissionKeys(): string[] {
  return Array.from(
    new Set([
      ...collectNavigationPermissionKeys((item) => [item.permission]),
      ...collectNavigationPermissionKeys((item) =>
        item.viewPermission ? [item.viewPermission] : [],
      ),
      ...collectNavigationPermissionKeys(
        (item) => item.alternatePermissions ?? [],
      ),
      ...setupNavigationPermissions,
      ...platformHomeFallbackPermissions,
    ]),
  );
}

/** Module read grants probed via member_has_grant_permission in the shell. */
export function collectPlatformShellGrantPermissionKeys(): string[] {
  return collectNavigationPermissionKeys((item) =>
    item.organisationScopeOnly ? [] : [item.permission],
  );
}
