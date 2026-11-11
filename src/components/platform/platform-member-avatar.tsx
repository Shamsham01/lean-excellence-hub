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
  withTooltip = true,
}: PlatformMemberAvatarProps) {
  const dimension = size === "sm" ? "size-8" : "size-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const isUnassigned =
    unassignedProp ??
    (displayName.trim().length === 0 ||
      displayName.trim().toLowerCase() === "unassigned");

  const tooltipLabel = isUnassigned ? "Unassigned" : displayName.trim();

  const avatarBody = isUnassigned ? (
    <span
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border",
        className,
      )}
      aria-hidden
    >
      <UserRound className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  ) : avatarUrl?.trim() ? (
    // eslint-disable-next-line @next/next/no-img-element -- profile URLs are user-supplied storage paths
    <img
      src={avatarUrl}
      alt=""
      className={cn(
        dimension,
        "shrink-0 rounded-full object-cover ring-1 ring-primary/20",
        className,
      )}
    />
  ) : (
    <span
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-primary/20",
        textSize,
        className,
      )}
      aria-hidden
    >
      {memberInitials(displayName)}
    </span>
  );

  const labelled = (
    <span
      className="inline-flex shrink-0 rounded-full"
      tabIndex={withTooltip ? 0 : undefined}
      aria-label={tooltipLabel}
      title={withTooltip ? undefined : tooltipLabel}
      data-testid="platform-member-avatar"
    >
      {avatarBody}
    </span>
  );

  if (!withTooltip) {
    return labelled;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{labelled}</TooltipTrigger>
      <TooltipContent side="top">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}
