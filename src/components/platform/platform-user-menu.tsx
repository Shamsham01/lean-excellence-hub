"use client";

import { Settings, UserRound } from "lucide-react";

import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { PlatformSignOutButton } from "@/components/platform/platform-sign-out-button";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { settingsNavigationItem } from "@/modules/platform-shell/navigation";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

const PROFILE_HREF = "/platform/settings/profile";

type PlatformUserMenuProps = {
  member: PlatformShellMember;
  showSettings?: boolean;
};

export function PlatformUserMenu({
  member,
  showSettings = true,
}: PlatformUserMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 min-h-10 rounded-full p-0"
          aria-label="Account menu"
          data-testid="platform-avatar"
        >
          <PlatformMemberAvatar
            displayName={member.displayName}
            avatarUrl={member.avatarUrl}
            size="md"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild>
          <AppLink
            href={PROFILE_HREF}
            className="flex cursor-pointer items-center gap-2"
          >
            <UserRound className="size-4" aria-hidden />
            Profile
          </AppLink>
        </DropdownMenuItem>
        {showSettings ? (
          <DropdownMenuItem asChild>
            <AppLink
              href={settingsNavigationItem.href}
              className="flex cursor-pointer items-center gap-2"
            >
              <Settings className="size-4" aria-hidden />
              Settings
            </AppLink>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
          <PlatformSignOutButton
            showIcon
            testId="platform-user-menu-sign-out"
            className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
