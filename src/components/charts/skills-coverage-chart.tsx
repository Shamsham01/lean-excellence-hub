"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { LehDonutChart } from "@/components/charts/leh-donut-chart";
import { LEH_CHART_COLORS } from "@/components/charts/chart-theme";

export function SkillsCoverageChart({
  coveragePercent,
}: {
  coveragePercent: number | null;
}) {
  if (coveragePercent == null) {
    return null;
  }

  const covered = Math.max(0, Math.min(100, Math.round(coveragePercent)));
  const gap = 100 - covered;

  return (
    <ChartCard
      title="Capability coverage"
      description="Published standard coverage across your workforce"
      testId="skills-coverage-donut-chart"
    >
      <LehDonutChart
        segments={[
          { name: "Covered", value: covered, fill: LEH_CHART_COLORS.success },
          { name: "Gap", value: gap, fill: LEH_CHART_COLORS.warning },
        ]}
        centreLabel="Coverage"
        centreValue={`${covered}%`}
        ariaLabel="Skills capability coverage donut chart"
      />
    </ChartCard>
  );
}
