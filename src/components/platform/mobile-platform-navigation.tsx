"use client";

import { useState } from "react";

import { LEH_BRAND } from "@/components/brand/brand-assets";
import { LehBrand } from "@/components/brand/leh-brand";
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
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";

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

  const closeDrawer = () => setOpen(false);

  return (
    <div
      data-testid="platform-mobile-chrome"
      className="sticky top-0 z-40 flex min-w-0 items-center gap-2 border-b border-border bg-sidebar/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-sm lg:hidden"
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
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
            notificationsSlot={
              notifications ? (
                <PlatformNotificationBell
                  variant="header"
                  initialUnreadCount={notifications.unreadCount}
                  initialItems={notifications.items}
                />
              ) : null
            }
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
    </div>
  );
}
