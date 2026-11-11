import type { ReactNode } from "react";

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
  return (
    <div
      className={cn("grid w-full min-w-0 gap-3", className)}
      style={
        tileCount != null && tileCount > 0
          ? {
              gridTemplateColumns: `repeat(${tileCount}, minmax(0, 1fr))`,
            }
          : {
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))",
            }
      }
      data-testid="kpi-stat-grid"
    >
      {children}
    </div>
  );
}
