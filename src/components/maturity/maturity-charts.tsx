"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { ChartCard } from "@/components/charts/chart-card";
import {
  LEH_CHART_COLORS,
  chartTickStyle,
} from "@/components/charts/chart-theme";
import {
  dedupePillarScores,
  type PillarScoreRow,
} from "@/components/maturity/pillar-scores-dedupe";

type PillarScore = PillarScoreRow;

export function MaturityRadarChart({ data }: { data: PillarScore[] }) {
  const chartData = dedupePillarScores(data);
  if (chartData.length === 0) {
    return null;
  }

  return (
    <ChartCard title="Pillar maturity" testId="kpi-radar-chart">
      <div
        className="h-64 w-full min-w-0"
        role="img"
        aria-label="Pillar maturity radar chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ ...chartTickStyle, fontSize: 10 }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke={LEH_CHART_COLORS.accent}
              fill={LEH_CHART_COLORS.accent}
              fillOpacity={0.22}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only mt-4 w-full text-sm">
        <caption>Pillar scores</caption>
        <thead>
          <tr>
            <th>Pillar</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}

export function PillarScoreList({ data }: { data: PillarScore[] }) {
  const rows = dedupePillarScores(data);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((pillar) => (
        <li
          key={pillar.name}
          className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2"
        >
          <span className="text-sm text-foreground">{pillar.name}</span>
          <span className="font-mono text-sm text-foreground tabular-nums">
            {pillar.score.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
