import { cn } from "@/lib/utils";

type PlatformMemberAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
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
}: PlatformMemberAvatarProps) {
  const dimension = size === "sm" ? "size-8" : "size-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (avatarUrl?.trim()) {
    return (
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
    );
  }

  return (
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
}
