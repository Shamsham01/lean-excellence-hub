import {
  groupPlatformNavigation,
  type PlatformNavItem,
} from "@/modules/platform-shell/navigation";

import { PlatformNavGroup } from "./platform-nav-group";

type PlatformNavigationProps = {
  items: PlatformNavItem[];
  onNavigate?: () => void;
};

export function PlatformNavigation({
  items,
  onNavigate,
}: PlatformNavigationProps) {
  const groups = groupPlatformNavigation(items);

  return (
    <nav
      className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 py-2"
      aria-label="Platform"
    >
      {groups.map((group) => (
        <PlatformNavGroup
          key={group.section}
          section={group.section}
          label={group.label}
          items={group.items}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </nav>
  );
}
