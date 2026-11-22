import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";

import { ChartCard } from "@/components/charts/chart-card";
import { LehAreaLineChart } from "@/components/charts/leh-area-line-chart";
import { LehBarChart } from "@/components/charts/leh-bar-chart";
import { LehDonutChart } from "@/components/charts/leh-donut-chart";
import { AnalyticsAgeingTable } from "@/components/platform/analytics-ageing-table";
import { AnalyticsDateRangeToolbar } from "@/components/platform/analytics-date-range-toolbar";
import { KpiStatCard } from "@/components/platform/kpi-stat-card";
import { KpiStatGrid } from "@/components/platform/kpi-stat-grid";
import {
  DEFAULT_KPI_POLARITY,
  type ModuleAnalyticsSnapshot,
} from "@/modules/platform-analytics/types";

export async function ModuleAnalyticsDashboard({
  snapshot,
  icons,
  testId,
  showDateRange = true,
  showAgeingTable = true,
  donutCenterLabel = "Total",
  showSectionHeading = true,
}: {
  snapshot: ModuleAnalyticsSnapshot;
  icons: Record<string, LucideIcon>;
  testId: string;
  showDateRange?: boolean;
  showAgeingTable?: boolean;
  donutCenterLabel?: string;
  showSectionHeading?: boolean;
}) {
  const donutTotal = snapshot.statusBreakdown.reduce(
    (sum, row) => sum + row.value,
    0,
  );

  return (
    <section className="flex flex-col gap-4" data-testid={testId}>
      {showSectionHeading || showDateRange ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showSectionHeading ? (
            <h2 className="text-base font-semibold text-foreground">
              Performance
            </h2>
          ) : (
            <span className="sr-only">Performance</span>
          )}
          {showDateRange ? (
            <Suspense fallback={null}>
              <AnalyticsDateRangeToolbar />
            </Suspense>
          ) : null}
        </div>
      ) : null}

      {!snapshot.hasData ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No activity in this period for your viewing scope. Widen the date
          range or wait for new records — numbers are never estimated.
        </p>
      ) : null}

      <KpiStatGrid tileCount={snapshot.stats.length}>
        {snapshot.stats.map((stat) => {
          const Icon = icons[stat.id] ?? icons.default;
          if (!Icon) return null;
          const polarity =
            stat.polarity ?? DEFAULT_KPI_POLARITY[stat.id] ?? "neutral";
          return (
            <KpiStatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              icon={Icon}
              polarity={polarity}
              {...(stat.trend ? { trend: stat.trend } : {})}
              {...(stat.valueTestId ? { valueTestId: stat.valueTestId } : {})}
              testId={`${testId}-stat-${stat.id}`}
            />
          );
        })}
      </KpiStatGrid>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {snapshot.trend.length > 0 ? (
          <ChartCard
            title="Activity trend"
            description="Volume in selected period"
          >
            <LehAreaLineChart
              data={snapshot.trend}
              ariaLabel="Activity trend"
              height={220}
            />
          </ChartCard>
        ) : null}

        {snapshot.statusBreakdown.length > 0 ? (
          <ChartCard
            title="Status breakdown"
            description="Current distribution"
          >
            <LehDonutChart
              segments={snapshot.statusBreakdown}
              centreLabel={donutCenterLabel}
              centreValue={donutTotal}
              ariaLabel="Status breakdown donut"
              height={220}
            />
          </ChartCard>
        ) : null}

        {snapshot.comparisonBars.length > 0 ? (
          <ChartCard
            title="Comparison"
            description="By site or owning unit"
            className="lg:col-span-2"
            testId="analytics-comparison-chart"
          >
            <LehBarChart
              data={snapshot.comparisonBars}
              ariaLabel="Comparison bar chart"
              height={220}
            />
          </ChartCard>
        ) : null}

        {showAgeingTable ? (
          <ChartCard
            title="Ageing & overdue"
            description="Items that need attention"
            className="lg:col-span-2"
          >
            <AnalyticsAgeingTable
              title="Ageing and overdue items"
              rows={snapshot.ageingRows}
              emptyLabel="Nothing overdue in this period."
            />
          </ChartCard>
        ) : null}
      </div>
    </section>
  );
}
