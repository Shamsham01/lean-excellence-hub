import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function KpiStatGrid({
  children,
  className,
  tileCount,
}: {
  children: ReactNode;
  className?: string;
  tileCount?: number;
}) {
  const style: CSSProperties | undefined =
    tileCount != null && tileCount > 0
      ? ({ "--kpi-tile-count": tileCount } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-3",
        tileCount != null && tileCount > 0
          ? "grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--kpi-tile-count),minmax(0,1fr))]"
          : "[grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]",
        className,
      )}
      style={style}
      data-testid="kpi-stat-grid"
    >
      {children}
    </div>
  );
}
