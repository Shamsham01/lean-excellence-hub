export type PlatformNavItem = {
  href: string;
  label: string;
  permission: string;
  section?: "main" | "improvement";
  icon?: string;
};

export const platformNavigation: PlatformNavItem[] = [
  {
    href: "/platform",
    label: "Home",
    permission: "maturity.read",
    section: "main",
  },
  {
    href: "/platform/maturity",
    label: "Maturity",
    permission: "maturity.read",
    section: "improvement",
  },
  {
    href: "/platform/actions",
    label: "Actions",
    permission: "actions.read",
    section: "improvement",
  },
  {
    href: "/platform/templates",
    label: "Templates",
    permission: "templates.read",
    section: "improvement",
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

export function isNavActive(pathname: string, href: string) {
  if (href === "/platform") {
    return pathname === "/platform";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
