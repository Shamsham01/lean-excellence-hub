"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { LehBarChart } from "@/components/charts/leh-bar-chart";
import { LEH_CHART_COLORS } from "@/components/charts/chart-theme";

export function ProblemSolvingStatusChart({
  pipeline,
}: {
  pipeline: Record<string, number | undefined>;
}) {
  const data = [
    {
      label: "Active",
      value: pipeline.active ?? 0,
      fill: LEH_CHART_COLORS.accent,
    },
    {
      label: "Draft",
      value: pipeline.draft ?? 0,
      fill: LEH_CHART_COLORS.warning,
    },
    {
      label: "Closed",
      value: pipeline.closed ?? 0,
      fill: LEH_CHART_COLORS.success,
    },
  ].filter((row) => row.value > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <ChartCard
      title="Case status"
      description="Portfolio distribution by lifecycle state"
      testId="pps-status-bar-chart"
    >
      <LehBarChart
        data={data}
        ariaLabel="Problem solving case status bar chart"
      />
    </ChartCard>
  );
}
