import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { KpiPolarity } from "@/modules/platform-analytics/types";
import type { TrendDelta } from "@/modules/platform-analytics/trend";
import { cn } from "@/lib/utils";

function numericValue(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function valueToneClass(
  value: string | number,
  polarity: KpiPolarity,
): string | undefined {
  const n = numericValue(value);
  if (n == null || n === 0 || polarity === "neutral") {
    return "text-foreground";
  }
  if (polarity === "lower-is-better") {
    return "text-destructive";
  }
  if (polarity === "higher-is-better") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  return "text-foreground";
}

function valueAriaHint(
  value: string | number,
  polarity: KpiPolarity,
): string | undefined {
  const n = numericValue(value);
  if (n == null || n === 0 || polarity === "neutral") return undefined;
  if (polarity === "lower-is-better") {
    return "Needs attention";
  }
  if (polarity === "higher-is-better") {
    return "Good";
  }
  return undefined;
}

export function KpiStatCard({
  label,
  value,
  icon: Icon,
  trend,
  polarity = "neutral",
  className,
  testId,
  valueTestId,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: TrendDelta;
  polarity?: KpiPolarity;
  className?: string;
  testId?: string;
  valueTestId?: string;
}) {
  const trendTone =
    trend?.direction === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : trend?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const valueClass = valueToneClass(value, polarity);
  const ariaHint = valueAriaHint(value, polarity);

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/60 bg-card shadow-xs",
        className,
      )}
      data-testid={testId}
    >
      <CardContent className="flex min-h-[7.5rem] flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trendTone,
              )}
            >
              <span className="sr-only">vs prior period </span>
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
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p
            className={cn(
              "font-mono text-2xl font-semibold tabular-nums",
              valueClass,
            )}
            data-testid={
              valueTestId ?? (testId ? `${testId}-value` : undefined)
            }
          >
            {ariaHint ? <span className="sr-only">{ariaHint} </span> : null}
            {value}
          </p>
        </div>
        <p className="text-center text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
