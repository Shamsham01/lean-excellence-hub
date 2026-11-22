"use client";

import { usePathname } from "next/navigation";

import {
  groupPlatformNavigation,
  type PlatformNavItem,
} from "@/modules/platform-shell/navigation";

import { PlatformNavGroupCollapsible } from "./platform-nav-group-collapsible";

type PlatformNavigationProps = {
  items: PlatformNavItem[];
  onNavigate?: () => void;
};

export function PlatformNavigation({
  items,
  onNavigate,
}: PlatformNavigationProps) {
  const pathname = usePathname();
  const groups = groupPlatformNavigation(items);

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      {groups.map((group) => (
        <PlatformNavGroupCollapsible
          key={group.section}
          section={group.section}
          label={group.label}
          items={group.items}
          activePathname={pathname}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </div>
  );
}
