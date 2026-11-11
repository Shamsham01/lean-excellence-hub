import { Suspense } from "react";
import {
  ClipboardList,
  Factory,
  Lightbulb,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import { ChartCard } from "@/components/charts/chart-card";
import { LehAreaLineChart } from "@/components/charts/leh-area-line-chart";
import { LehDonutChart } from "@/components/charts/leh-donut-chart";
import { AnalyticsAgeingTable } from "@/components/platform/analytics-ageing-table";
import { AnalyticsInsightsCollapsible } from "@/components/platform/analytics-insights-collapsible";
import { AnalyticsDateRangeToolbar } from "@/components/platform/analytics-date-range-toolbar";
import { KpiStatCard } from "@/components/platform/kpi-stat-card";
import { KpiStatGrid } from "@/components/platform/kpi-stat-grid";
import type { HomeAnalyticsBundle } from "@/modules/platform-analytics/home";
import { DEFAULT_KPI_POLARITY } from "@/modules/platform-analytics/types";

const HOME_ICONS: Record<string, LucideIcon> = {
  "actions-open": ListChecks,
  "actions-overdue": ClipboardList,
  "pps-active": Factory,
  "pps-opened": Factory,
  "ideas-awaiting": Lightbulb,
  "ideas-submitted": Lightbulb,
  "5s-completed": ListChecks,
  "5s-avg": ListChecks,
  default: ListChecks,
};

export function PlatformHomeAnalytics({ data }: { data: HomeAnalyticsBundle }) {
  const donutTotal = data.workloadDonut.reduce((s, r) => s + r.value, 0);

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="platform-home-analytics"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Operational analytics
        </h2>
        <Suspense fallback={null}>
          <AnalyticsDateRangeToolbar />
        </Suspense>
      </div>

      {data.stats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No module metrics are visible with your access in this period.
        </p>
      ) : (
        <KpiStatGrid tileCount={data.stats.length}>
          {data.stats.map((stat) => (
            <KpiStatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              icon={HOME_ICONS[stat.id] ?? ListChecks}
              polarity={
                stat.polarity ?? DEFAULT_KPI_POLARITY[stat.id] ?? "neutral"
              }
              {...(stat.trend ? { trend: stat.trend } : {})}
              {...(stat.valueTestId ? { valueTestId: stat.valueTestId } : {})}
              testId={`home-stat-${stat.id}`}
            />
          ))}
        </KpiStatGrid>
      )}

      {data.hasData ? (
        <AnalyticsInsightsCollapsible
          title="Operational insights"
          testId="platform-home-analytics-insights"
        >
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {data.combinedTrend.length > 0 ? (
              <ChartCard
                title="Activity trend"
                description="Combined opens and submissions"
                testId="home-chart-area-line"
              >
                <LehAreaLineChart
                  data={data.combinedTrend}
                  ariaLabel="Home activity trend"
                  height={220}
                />
              </ChartCard>
            ) : null}
            {data.workloadDonut.length > 0 ? (
              <ChartCard
                title="Work queue"
                description="What needs attention now"
                testId="home-chart-donut"
              >
                <LehDonutChart
                  segments={data.workloadDonut}
                  centreLabel="Items"
                  centreValue={donutTotal}
                  ariaLabel="Work queue breakdown"
                  height={220}
                />
              </ChartCard>
            ) : null}
            <ChartCard
              title="Overdue & ageing"
              description="Across actions, cases, and ideas"
              className="lg:col-span-2"
            >
              <AnalyticsAgeingTable
                title="Overdue items"
                rows={data.ageingRows}
                emptyLabel="Nothing overdue in this period."
              />
            </ChartCard>
          </div>
        </AnalyticsInsightsCollapsible>
      ) : null}
    </section>
  );
}
