"use client";

import type { ReactNode } from "react";
import { LogOut, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { PlatformNavIconComponent } from "@/components/platform/platform-nav-icons";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import {
  isNavItemActive,
  settingsNavigationItem,
} from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

const PROFILE_HREF = "/platform/settings/profile";

type PlatformSidebarFooterProps = {
  member: PlatformShellMember;
  showSettings: boolean;
  onNavigate?: () => void;
};

function CompactNavLink({
  href,
  testId,
  active,
  onNavigate,
  children,
}: {
  href: string;
  testId: string;
  active: boolean;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  return (
    <AppLink
      href={href}
      data-testid={testId}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </AppLink>
  );
}

export function PlatformSidebarFooter({
  member,
  showSettings,
  onNavigate,
}: PlatformSidebarFooterProps) {
  const pathname = usePathname();
  const settingsActive = isNavItemActive(pathname, settingsNavigationItem);
  const profileActive = pathname.startsWith(PROFILE_HREF);

  return (
    <div
      className="mt-auto flex flex-col gap-2 border-t border-sidebar-border/80 px-2 py-3"
      data-testid="platform-sidebar-account"
    >
      <AppLink
        href={PROFILE_HREF}
        className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1 hover:bg-sidebar-accent/60"
        {...(onNavigate ? { onClick: onNavigate } : {})}
        data-testid="platform-sidebar-profile-link"
      >
        <PlatformMemberAvatar
          displayName={member.displayName}
          avatarUrl={member.avatarUrl}
          size="sm"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-sidebar-foreground">
            {member.displayName}
          </span>
          {member.roleLabel ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {member.roleLabel}
            </span>
          ) : null}
        </span>
      </AppLink>
      <div className="flex flex-wrap items-center gap-1 px-1">
        {showSettings ? (
          <CompactNavLink
            href={settingsNavigationItem.href}
            testId="platform-nav-settings"
            active={settingsActive}
            {...(onNavigate ? { onNavigate } : {})}
          >
            <PlatformNavIconComponent
              icon={settingsNavigationItem.icon}
              className="size-3.5 shrink-0"
            />
            Settings
          </CompactNavLink>
        ) : null}
        <CompactNavLink
          href={PROFILE_HREF}
          testId="platform-nav-profile"
          active={profileActive}
          {...(onNavigate ? { onNavigate } : {})}
        >
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          Profile
        </CompactNavLink>
        <form action="/auth/signout" method="post" className="ms-auto">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2 text-xs text-muted-foreground"
          >
            <LogOut className="size-3.5" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
