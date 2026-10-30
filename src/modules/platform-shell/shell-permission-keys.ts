import { platformHomeFallbackPermissions } from "@/modules/platform-shell/home-fallback";
import { platformNavigation } from "@/modules/platform-shell/navigation";

export const setupNavigationPermissions = [
  "hierarchy.manage",
  "invitations.manage",
  "memberships.manage",
] as const;

export function collectPlatformShellPermissionKeys(): string[] {
  return Array.from(
    new Set([
      ...platformNavigation.map((item) => item.permission),
      ...platformNavigation.flatMap((item) =>
        item.viewPermission ? [item.viewPermission] : [],
      ),
      ...platformNavigation.flatMap((item) => item.alternatePermissions ?? []),
      ...setupNavigationPermissions,
      ...platformHomeFallbackPermissions,
    ]),
  );
}
