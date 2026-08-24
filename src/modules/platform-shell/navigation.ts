export type PlatformNavItem = {
  href: string;
  label: string;
  permission: string;
};

export const platformNavigation: PlatformNavItem[] = [
  { href: "/platform", label: "Home", permission: "actions.read" },
  { href: "/platform/actions", label: "Actions", permission: "actions.read" },
  {
    href: "/platform/templates",
    label: "Templates",
    permission: "templates.read",
  },
];

export function filterPlatformNavigation(
  grantedPermissions:
    ReadonlySet<string> | ((permissionKey: string) => boolean),
) {
  const hasPermission =
    typeof grantedPermissions === "function"
      ? grantedPermissions
      : (permissionKey: string) => grantedPermissions.has(permissionKey);

  return platformNavigation.filter((item) => hasPermission(item.permission));
}
