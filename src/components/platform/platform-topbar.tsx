"use client";

import { Bell, Search } from "lucide-react";
import { useState } from "react";

import { PlatformCommandMenu } from "@/components/platform/platform-command-menu";
import { ThemeToggleIcon } from "@/components/platform/theme-toggle";
import { Button } from "@/components/ui/button";
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

  return (
    <>
      <header
        data-testid="platform-topbar"
        className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card/80 px-4 backdrop-blur-md sm:px-6"
      >
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-sm font-medium text-foreground">
            {organisationName}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 flex-1 gap-2 border-border/60 bg-background/80 text-muted-foreground sm:max-w-xs sm:flex-none"
          onClick={() => setCommandOpen(true)}
          data-testid="platform-command-trigger"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Search…</span>
          <kbd className="ml-auto hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono-data text-[10px] text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggleIcon />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-9 min-h-9"
            aria-label="Notifications"
            data-testid="platform-notifications"
          >
            <Bell className="size-4" aria-hidden />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
          </Button>
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary",
              "ring-1 ring-primary/25",
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
