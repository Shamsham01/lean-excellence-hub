export type PlatformNavSection = "main" | "improvement" | "people" | "platform";

export type PlatformNavItem = {
  href: string;
  label: string;
  permission: string;
  organisationScopeOnly?: boolean;
  section?: PlatformNavSection;
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
    href: "/platform/5s",
    label: "5S",
    permission: "five_s.read",
    section: "improvement",
  },
  {
    href: "/platform/gemba",
    label: "Gemba",
    permission: "gemba.read",
    section: "improvement",
  },
  {
    href: "/platform/actions",
    label: "Actions",
    permission: "actions.read",
    section: "improvement",
  },
  {
    href: "/platform/projects",
    label: "Projects",
    permission: "projects.read",
    section: "improvement",
  },
  {
    href: "/platform/benefits",
    label: "Benefits",
    permission: "benefits.read",
    section: "improvement",
  },
  {
    href: "/platform/problem-solving",
    label: "Problem solving",
    permission: "problem_solving.view",
    section: "improvement",
  },
  {
    href: "/platform/suggestions",
    label: "Suggestions",
    permission: "suggestions.read",
    section: "improvement",
  },
  {
    href: "/platform/people",
    label: "People",
    permission: "people.capability.read",
    section: "people",
  },
  {
    href: "/platform/training",
    label: "Training",
    permission: "training.read",
    section: "people",
  },
  {
    href: "/platform/skills",
    label: "Skills",
    permission: "skills.read",
    section: "people",
  },
  {
    href: "/platform/recognition",
    label: "Recognition",
    permission: "recognition.read",
    section: "people",
  },
  {
    href: "/platform/schedule",
    label: "Schedule",
    permission: "schedules.read",
    section: "platform",
  },
  {
    href: "/platform/templates",
    label: "Templates",
    permission: "templates.read",
    section: "platform",
  },
  {
    href: "/platform/settings/ai",
    label: "Lean AI",
    permission: "ai.manage_settings",
    organisationScopeOnly: true,
    section: "platform",
  },
];

export const setupNavigationItem: PlatformNavItem = {
  href: "/platform/setup",
  label: "Setup",
  permission: "actions.read",
  section: "main",
};

export const settingsNavigationItem: PlatformNavItem = {
  href: "/platform/settings",
  label: "Settings",
  permission: "hierarchy.read",
  section: "platform",
};

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
