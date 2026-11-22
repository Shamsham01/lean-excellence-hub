"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { LEH_BRAND } from "@/components/brand/brand-assets";
import { LehBrand } from "@/components/brand/leh-brand";
import { PlatformCommandMenu } from "@/components/platform/platform-command-menu";
import { PlatformUserMenu } from "@/components/platform/platform-user-menu";
import { ThemeToggleIcon } from "@/components/platform/theme-toggle";
import { PlatformNavigation } from "@/components/platform/platform-navigation";
import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";
import { PlatformSidebarHeader } from "@/components/platform/platform-sidebar-header";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

type MobilePlatformNavigationProps = {
  items: PlatformNavItem[];
  organisationName: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  member: PlatformShellMember;
  showSettings: boolean;
  notifications: {
    unreadCount: number;
    items: PlatformInAppNotification[];
  } | null;
};

export function MobilePlatformNavigation({
  items,
  organisationName,
  organisations,
  siteContext,
  member,
  showSettings,
  notifications,
}: MobilePlatformNavigationProps) {
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const closeDrawer = () => setOpen(false);

  return (
    <>
      <div
        data-testid="platform-mobile-chrome"
        className="sticky top-0 z-50 flex min-w-0 items-center gap-1.5 border-b border-border bg-card/95 px-3 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] shadow-[var(--shadow-theme-xs)] backdrop-blur-sm lg:hidden"
      >
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="shrink-0"
              aria-label="Open navigation menu"
            >
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-dvh max-h-dvh min-h-0 w-[min(100%,16rem)] flex-col gap-0 overflow-hidden bg-sidebar p-0 pb-[env(safe-area-inset-bottom,0px)]"
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">Platform navigation</SheetTitle>
            <PlatformSidebarHeader
              organisationName={organisationName}
              organisations={organisations}
              siteContext={siteContext}
              closeGutter
            />
            <div
              className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
              role="navigation"
              aria-label="Platform"
            >
              <PlatformNavigation items={items} onNavigate={closeDrawer} />
              <PlatformSidebarFooter
                member={member}
                showSettings={showSettings}
                onNavigate={closeDrawer}
              />
            </div>
          </SheetContent>
        </Sheet>
        <AppLink
          href="/platform"
          aria-label={LEH_BRAND.name}
          className="leh-brand-link shrink-0 [--leh-brand-mark:1.75rem]"
        >
          <LehBrand decorative variant="icon" />
        </AppLink>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          data-testid="platform-mobile-org-name"
        >
          {organisationName}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-9 min-w-9 shrink-0"
            aria-label="Search modules, cases, and actions"
            data-testid="platform-mobile-command-trigger"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-4" aria-hidden />
          </Button>
          <ThemeToggleIcon />
          {notifications ? (
            <PlatformNotificationBell
              initialUnreadCount={notifications.unreadCount}
              initialItems={notifications.items}
            />
          ) : null}
          <PlatformUserMenu member={member} showSettings={showSettings} />
        </div>
      </div>
      <PlatformCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
