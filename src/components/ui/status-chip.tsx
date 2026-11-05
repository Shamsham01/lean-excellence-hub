import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "critical" | "info";
};

const toneClass: Record<NonNullable<StatusChipProps["tone"]>, string> = {
  neutral: "border-border/60 bg-muted/60 text-muted-foreground",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  critical: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-primary/25 bg-primary/10 text-primary",
};

export function StatusChip({
  className,
  tone = "neutral",
  ...props
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono-data text-[11px] font-medium uppercase",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
