"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <Link
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <PlatformNavIconComponent icon={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
