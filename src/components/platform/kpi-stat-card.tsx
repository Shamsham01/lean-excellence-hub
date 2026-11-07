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
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: TrendDelta;
  className?: string;
  testId?: string;
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
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className="mt-1 font-mono text-2xl font-semibold text-foreground tabular-nums"
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </p>
          {trend ? (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                trendTone,
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUp className="size-3.5" aria-hidden />
              ) : trend.direction === "down" ? (
                <ArrowDown className="size-3.5" aria-hidden />
              ) : (
                <Minus className="size-3.5" aria-hidden />
              )}
              {trend.percent == null
                ? "New vs prior period"
                : `${trend.percent > 0 ? "+" : ""}${trend.percent}% vs prior period`}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
