import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { TrendDelta } from "@/modules/platform-analytics/trend";
import { cn } from "@/lib/utils";

export function KpiStatCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
  testId,
  valueTestId,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: TrendDelta;
  className?: string;
  testId?: string;
  valueTestId?: string;
}) {
  const trendTone =
    trend?.direction === "up"
      ? "text-success"
      : trend?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/60 bg-card shadow-xs",
        className,
      )}
      data-testid={testId}
    >
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p
              className="font-mono text-xl font-semibold text-foreground tabular-nums"
              data-testid={
                valueTestId ?? (testId ? `${testId}-value` : undefined)
              }
            >
              {value}
            </p>
            {trend ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  trendTone,
                )}
              >
                {trend.direction === "up" ? (
                  <ArrowUp className="size-3" aria-hidden />
                ) : trend.direction === "down" ? (
                  <ArrowDown className="size-3" aria-hidden />
                ) : (
                  <Minus className="size-3" aria-hidden />
                )}
                {trend.percent == null
                  ? "New"
                  : `${trend.percent > 0 ? "+" : ""}${trend.percent}%`}
              </span>
            ) : null}
          </div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
