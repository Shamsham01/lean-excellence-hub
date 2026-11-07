import type { ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
  className,
  testId,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col items-center gap-5 rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center shadow-[var(--shadow-theme-xs)] sm:px-8",
        className,
      )}
      data-testid={testId}
    >
      <div
        className="relative grid size-16 place-items-center rounded-2xl border border-dashed border-border/80 bg-muted/30"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[12px_12px] opacity-40" />
        <div className="relative flex size-11 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-[var(--shadow-theme-xs)]">
          {icon}
        </div>
      </div>
      <div className="flex max-w-md flex-col gap-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actionLabel && actionHref ? (
        <Button asChild>
          <AppLink href={actionHref}>{actionLabel}</AppLink>
        </Button>
      ) : actionLabel && onAction ? (
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
