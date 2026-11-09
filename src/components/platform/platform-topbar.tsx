"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";

import { PlatformCommandMenu } from "@/components/platform/platform-command-menu";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { PlatformUserMenu } from "@/components/platform/platform-user-menu";
import { ThemeToggleIcon } from "@/components/platform/theme-toggle";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

type PlatformTopbarProps = {
  member: PlatformShellMember;
  organisationName: string;
  showSettings?: boolean;
  notifications: {
    unreadCount: number;
    items: PlatformInAppNotification[];
  } | null;
};

export function PlatformTopbar({
  member,
  organisationName,
  showSettings = true,
  notifications,
}: PlatformTopbarProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <header
        data-testid="platform-topbar"
        className="sticky top-0 z-50 hidden h-[4.25rem] shrink-0 items-center border-b border-border/80 bg-card px-4 shadow-[var(--shadow-theme-xs)] sm:px-6 lg:flex"
      >
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-sm font-medium text-foreground">
            {organisationName}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-md lg:flex-none">
          <InputGroup className="bg-background/80">
            <InputGroupAddon>
              <Search className="size-4" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchRef}
              placeholder="Search modules, cases, actions…"
              onFocus={() => setCommandOpen(true)}
              data-testid="platform-command-trigger"
            />
            <InputGroupAddon align="inline-end">
              <Badge
                variant="outline"
                className="font-mono-data hidden cursor-default text-[10px] tracking-tight sm:inline-flex"
              >
                ⌘ K
              </Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="ml-auto flex items-center gap-1.5 ps-2">
          <ThemeToggleIcon />
          {notifications ? (
            <PlatformNotificationBell
              initialUnreadCount={notifications.unreadCount}
              initialItems={notifications.items}
            />
          ) : null}
          <PlatformUserMenu member={member} showSettings={showSettings} />
        </div>
      </header>
      <PlatformCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
