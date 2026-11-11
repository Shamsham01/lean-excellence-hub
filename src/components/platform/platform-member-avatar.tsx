"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PlatformMemberAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
  unassigned?: boolean;
  /** Off by default — enable only when the avatar is not inside another focusable control. */
  withTooltip?: boolean;
};

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function PlatformMemberAvatar({
  displayName,
  avatarUrl,
  size = "md",
  className,
  unassigned: unassignedProp,
  withTooltip = false,
}: PlatformMemberAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimension = size === "sm" ? "size-8" : "size-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const isUnassigned =
    unassignedProp ??
    (displayName.trim().length === 0 ||
      displayName.trim().toLowerCase() === "unassigned");

  const accessibleName = isUnassigned ? "Unassigned" : displayName.trim();
  const showImage =
    !isUnassigned && Boolean(avatarUrl?.trim()) && !imageFailed;

  const avatarBody = isUnassigned ? (
    <span
      role="img"
      aria-label={accessibleName}
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border",
        className,
      )}
    >
      <UserRound
        className={size === "sm" ? "size-4" : "size-5"}
        aria-hidden
      />
    </span>
  ) : showImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- profile URLs are user-supplied storage paths
    <img
      role="img"
      aria-label={accessibleName}
      src={avatarUrl!}
      alt=""
      onError={() => setImageFailed(true)}
      className={cn(
        dimension,
        "shrink-0 rounded-full object-cover ring-1 ring-primary/20",
        className,
      )}
    />
  ) : (
    <span
      role="img"
      aria-label={accessibleName}
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-primary/20",
        textSize,
        className,
      )}
    >
      {memberInitials(displayName)}
    </span>
  );

  const avatar = (
    <span
      className="inline-flex shrink-0 rounded-full"
      data-testid="platform-member-avatar"
    >
      {avatarBody}
    </span>
  );

  if (!withTooltip) {
    return avatar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 rounded-full">{avatarBody}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{accessibleName}</TooltipContent>
    </Tooltip>
  );
}
