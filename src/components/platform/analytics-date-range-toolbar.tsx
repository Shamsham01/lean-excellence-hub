"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SegmentedControl } from "@/components/ui/segmented-control";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get(paramName);
  const active = raw ? Number(raw) : 30;

  return (
    <SegmentedControl
      aria-label="Analytics date range"
      className={cn(
        "border-border bg-card [&_button[aria-checked=true]]:bg-primary [&_button[aria-checked=true]]:text-primary-foreground",
        className,
      )}
      optionTestIdPrefix="analytics-range"
      value={String(active)}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramName, next);
        router.push(`${pathname}?${params.toString()}`);
      }}
      options={ANALYTICS_RANGE_OPTIONS.map((days) => ({
        value: String(days),
        label: `${days} days`,
      }))}
      data-testid="analytics-date-range"
    />
  );
}
