"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";

import { PlatformCommandMenu } from "@/components/platform/platform-command-menu";
import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { ThemeToggleIcon } from "@/components/platform/theme-toggle";
import { AppLink } from "@/components/ui/app-link";
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
};

export function PlatformTopbar({
  member,
  organisationName,
}: PlatformTopbarProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <header
        data-testid="platform-topbar"
        className="sticky top-0 z-50 flex h-[4.25rem] shrink-0 items-center border-b border-border/80 bg-card px-4 shadow-[var(--shadow-theme-xs)] sm:px-6"
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
          <AppLink
            href="/platform/settings/profile"
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Your profile"
            data-testid="platform-avatar"
          >
            <PlatformMemberAvatar
              displayName={member.displayName}
              avatarUrl={member.avatarUrl}
              size="md"
            />
          </AppLink>
        </div>
      </header>
      <PlatformCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
