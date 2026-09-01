"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/platform/theme-toggle";
import { PlatformNavIconComponent } from "@/components/platform/platform-nav-icons";
import { Button } from "@/components/ui/button";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import {
  isNavItemActive,
  settingsNavigationItem,
} from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

type PlatformSidebarFooterProps = {
  member: PlatformShellMember;
  showSettings: boolean;
  onNavigate?: () => void;
};

function FooterSettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, settingsNavigationItem);

  return (
    <Link
      href={settingsNavigationItem.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <PlatformNavIconComponent
        icon={settingsNavigationItem.icon}
        className="size-4 shrink-0"
      />
      Settings
    </Link>
  );
}

export function PlatformSidebarFooter({
  member,
  showSettings,
  onNavigate,
}: PlatformSidebarFooterProps) {
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-sidebar-border p-2">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-sidebar-foreground">
          {member.displayName}
        </p>
        {member.roleLabel ? (
          <p className="truncate text-xs text-muted-foreground">
            {member.roleLabel}
          </p>
        ) : null}
      </div>
      {showSettings ? (
        <FooterSettingsLink {...(onNavigate ? { onNavigate } : {})} />
      ) : null}
      <ThemeToggle />
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="min-h-11 w-full justify-start gap-2 text-sidebar-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}
