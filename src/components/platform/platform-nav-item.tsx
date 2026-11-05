"use client";

import { usePathname } from "next/navigation";

import { AppLink } from "@/components/ui/app-link";

import { PlatformNavIconComponent } from "@/components/platform/platform-nav-icons";
import {
  isNavItemActive,
  type PlatformNavItem,
} from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

type PlatformNavItemLinkProps = {
  item: PlatformNavItem;
  onNavigate?: () => void;
};

export function PlatformNavItemLink({
  item,
  onNavigate,
}: PlatformNavItemLinkProps) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item);

  return (
    <AppLink
      href={item.href}
      data-testid={`platform-nav-${item.icon}`}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
        active
          ? "bg-primary/10 font-semibold text-primary shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <PlatformNavIconComponent icon={item.icon} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.navBadge ? (
        <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono-data text-[10px] font-semibold tracking-wide text-primary uppercase">
          {item.navBadge}
        </span>
      ) : null}
    </AppLink>
  );
}
