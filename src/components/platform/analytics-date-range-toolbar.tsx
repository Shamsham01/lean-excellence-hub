"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { ANALYTICS_RANGE_OPTIONS } from "@/modules/platform-analytics/date-range";

export function AnalyticsDateRangeToolbar({
  paramName = "range",
  className,
}: {
  paramName?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = Number(searchParams.get(paramName) ?? "30");

  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1",
        className,
      )}
      role="group"
      aria-label="Analytics date range"
      data-testid="analytics-date-range"
    >
      {ANALYTICS_RANGE_OPTIONS.map((days) => {
        const selected =
          active === days || (!searchParams.get(paramName) && days === 30);
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramName, String(days));
        const href = `${pathname}?${params.toString()}`;
        return (
          <a
            key={days}
            href={href}
            className={cn(
              "min-h-9 rounded-md px-3 text-sm font-medium transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            data-testid={`analytics-range-${days}`}
          >
            {days} days
          </a>
        );
      })}
    </div>
  );
}
