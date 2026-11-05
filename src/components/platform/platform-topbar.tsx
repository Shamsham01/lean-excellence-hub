"use client";

import { Bell, Search } from "lucide-react";
import { useRef, useState } from "react";

import { PlatformCommandMenu } from "@/components/platform/platform-command-menu";
import { ThemeToggleIcon } from "@/components/platform/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import { cn } from "@/lib/utils";

type PlatformTopbarProps = {
  member: PlatformShellMember;
  organisationName: string;
};

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative size-10"
            aria-label="Notifications"
            data-testid="platform-notifications"
          >
            <Bell className="size-4" aria-hidden />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
          </Button>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
              "ring-1 ring-primary/20",
            )}
            data-testid="platform-avatar"
            title={member.displayName}
          >
            {memberInitials(member.displayName)}
          </div>
        </div>
      </header>
      <PlatformCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
