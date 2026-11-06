"use client";

import { usePathname } from "next/navigation";
import { User } from "lucide-react";

import { PlatformNavIconComponent } from "@/components/platform/platform-nav-icons";
import { AppLink } from "@/components/ui/app-link";
import {
  isNavItemActive,
  settingsNavigationItem,
} from "@/modules/platform-shell/navigation";
import { cn } from "@/lib/utils";

type PlatformSidebarFooterProps = {
  membershipId: string;
  showSettings: boolean;
  onNavigate?: () => void;
};

function FooterSettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, settingsNavigationItem);

  return (
    <AppLink
      href={settingsNavigationItem.href}
      data-testid="platform-nav-settings"
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
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
    </AppLink>
  );
}

function FooterProfileLink({
  membershipId,
  onNavigate,
}: {
  membershipId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = `/platform/people/${membershipId}`;
  const active =
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <AppLink
      href={href}
      data-testid="platform-nav-profile"
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <User className="size-4 shrink-0" aria-hidden />
      Profile
    </AppLink>
  );
}

export function PlatformSidebarFooter({
  membershipId,
  showSettings,
  onNavigate,
}: PlatformSidebarFooterProps) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border p-2">
      {showSettings ? (
        <FooterSettingsLink {...(onNavigate ? { onNavigate } : {})} />
      ) : null}
      <FooterProfileLink
        membershipId={membershipId}
        {...(onNavigate ? { onNavigate } : {})}
      />
    </div>
  );
}
