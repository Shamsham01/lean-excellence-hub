export type PlatformNavSection = "main" | "improvement" | "people" | "platform";

export type PlatformNavIcon =
  | "home"
  | "maturity"
  | "five-s"
  | "gemba"
  | "actions"
  | "projects"
  | "benefits"
  | "problem-solving"
  | "suggestions"
  | "people"
  | "training"
  | "skills"
  | "recognition"
  | "schedule"
  | "templates"
  | "setup"
  | "lean-ai"
  | "settings";

export type PlatformNavItem = {
  href: string;
  label: string;
  permission: string;
  icon: PlatformNavIcon;
  organisationScopeOnly?: boolean;
  universalAccess?: boolean;
  section?: PlatformNavSection;
  routeMatcher?: (pathname: string) => boolean;
};

export const platformNavSectionOrder: PlatformNavSection[] = [
  "main",
  "improvement",
  "people",
  "platform",
];

export const platformNavSectionLabels: Record<
  PlatformNavSection,
  string | null
> = {
  main: null,
  improvement: "Improvement",
  people: "People & capability",
  platform: "Operations",
};

export const platformNavigation: PlatformNavItem[] = [
  {
    href: "/platform",
    label: "Home",
    permission: "maturity.read",
    icon: "home",
    section: "main",
  },
  {
    href: "/platform/maturity",
    label: "Maturity",
    permission: "maturity.read",
    icon: "maturity",
    section: "improvement",
  },
  {
    href: "/platform/5s",
    label: "5S",
    permission: "five_s.read",
    icon: "five-s",
    section: "improvement",
  },
  {
    href: "/platform/gemba",
    label: "Gemba",
    permission: "gemba.read",
    icon: "gemba",
    section: "improvement",
  },
  {
    href: "/platform/actions",
    label: "Actions",
    permission: "actions.read",
    icon: "actions",
    section: "improvement",
  },
  {
    href: "/platform/projects",
    label: "Projects",
    permission: "projects.read",
    icon: "projects",
    section: "improvement",
  },
  {
    href: "/platform/benefits",
    label: "Benefits",
    permission: "benefits.read",
    icon: "benefits",
    section: "improvement",
  },
  {
    href: "/platform/problem-solving",
    label: "Problem solving",
    permission: "problem_solving.view",
    icon: "problem-solving",
    section: "improvement",
  },
  {
    href: "/platform/suggestions",
    label: "Suggestions",
    permission: "suggestions.read",
    icon: "suggestions",
    section: "improvement",
  },
  {
    href: "/platform/people",
    label: "People",
    permission: "people.capability.read",
    icon: "people",
    section: "people",
  },
  {
    href: "/platform/training",
    label: "Training",
    permission: "training.read",
    icon: "training",
    section: "people",
  },
  {
    href: "/platform/skills",
    label: "Skills",
    permission: "skills.read",
    icon: "skills",
    section: "people",
  },
  {
    href: "/platform/recognition",
    label: "Recognition",
    permission: "recognition.read",
    icon: "recognition",
    section: "people",
  },
  {
    href: "/platform/schedule",
    label: "Schedule",
    permission: "schedules.read",
    icon: "schedule",
    section: "platform",
  },
  {
    href: "/platform/templates",
    label: "Templates",
    permission: "templates.read",
    icon: "templates",
    section: "platform",
  },
  {
    href: "/platform/settings/ai",
    label: "Lean AI",
    permission: "ai.manage_settings",
    organisationScopeOnly: true,
    icon: "lean-ai",
    section: "platform",
  },
];

export const setupNavigationItem: PlatformNavItem = {
  href: "/platform/setup",
  label: "Setup",
  permission: "hierarchy.manage",
  icon: "setup",
  section: "main",
};

export const settingsNavigationItem: PlatformNavItem = {
  href: "/platform/settings",
  label: "Settings",
  permission: "people.capability.read",
  universalAccess: true,
  icon: "settings",
  section: "platform",
  routeMatcher: isSettingsNavActive,
};

export function isNavActive(pathname: string, href: string) {
  if (href === "/platform") {
    return pathname === "/platform";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isSettingsNavActive(pathname: string) {
  if (!pathname.startsWith("/platform/settings")) {
    return false;
  }

  return !pathname.startsWith("/platform/settings/ai");
}

export function isNavItemActive(pathname: string, item: PlatformNavItem) {
  if (item.routeMatcher) {
    return item.routeMatcher(pathname);
  }

  return isNavActive(pathname, item.href);
}

export function groupPlatformNavigation(items: PlatformNavItem[]) {
  return platformNavSectionOrder
    .map((section) => ({
      section,
      label: platformNavSectionLabels[section],
      items: items.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0);
}

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
