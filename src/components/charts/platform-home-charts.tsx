"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { LehAreaLineChart } from "@/components/charts/leh-area-line-chart";
import { LehBarChart } from "@/components/charts/leh-bar-chart";
import { LEH_CHART_COLORS } from "@/components/charts/chart-theme";

export type PlatformHomeChartInput = {
  trend: Array<{ label: string; value: number }>;
  workload: Array<{ label: string; value: number }>;
};

export function PlatformHomeCharts({
  trend,
  workload,
}: PlatformHomeChartInput) {
  const barData = workload.map((row, index) => ({
    ...row,
    fill:
      index === 1 && row.value > 0
        ? LEH_CHART_COLORS.critical
        : LEH_CHART_COLORS.accent,
  }));

  return (
    <div
      className="grid min-w-0 gap-6 lg:grid-cols-2"
      data-testid="platform-home-charts"
    >
      <ChartCard
        title="Operational trend"
        description="Recent activity index across your Lean system"
        testId="home-chart-area-line"
      >
        <LehAreaLineChart
          data={trend}
          ariaLabel="Operational trend line chart"
        />
      </ChartCard>
      <ChartCard
        title="Work queue"
        description="Items that shape this week's improvement focus"
        testId="home-chart-bar"
      >
        <LehBarChart data={barData} ariaLabel="Work queue bar chart" />
      </ChartCard>
    </div>
  );
}
