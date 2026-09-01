"use client";

import { useState } from "react";

import { PlatformNavigation } from "@/components/platform/platform-navigation";
import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";
import { PlatformSidebarHeader } from "@/components/platform/platform-sidebar-header";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";

type MobilePlatformNavigationProps = {
  items: PlatformNavItem[];
  organisationName: string;
  organisations: EligibleOrganisation[];
  member: PlatformShellMember;
  showSettings: boolean;
};

export function MobilePlatformNavigation({
  items,
  organisationName,
  organisations,
  member,
  showSettings,
}: MobilePlatformNavigationProps) {
  const [open, setOpen] = useState(false);

  const closeDrawer = () => setOpen(false);

  return (
    <div className="flex items-center gap-2 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
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
          className="flex h-full max-h-dvh w-[min(100%,16rem)] flex-col overflow-hidden bg-sidebar p-0"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Platform navigation</SheetTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PlatformSidebarHeader
              organisationName={organisationName}
              organisations={organisations}
            />
            <PlatformNavigation items={items} onNavigate={closeDrawer} />
            <PlatformSidebarFooter
              member={member}
              showSettings={showSettings}
              onNavigate={closeDrawer}
            />
          </div>
        </SheetContent>
      </Sheet>
      <span
        className="truncate text-sm font-semibold"
        data-testid="platform-mobile-org-name"
      >
        {organisationName}
      </span>
    </div>
  );
}
