"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { chartPieTooltipProps, LEH_CHART_COLORS } from "./chart-theme";

export type DonutSegment = { name: string; value: number; fill?: string };

export function LehDonutChart({
  segments,
  centreLabel,
  centreValue,
  ariaLabel,
  height = 260,
}: {
  segments: DonutSegment[];
  centreLabel: string;
  centreValue: string | number;
  ariaLabel: string;
  height?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className="leh-recharts relative w-full min-w-0 sm:w-1/2"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...chartPieTooltipProps} />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {segments.map((entry, index) => {
                const fill =
                  entry.fill ??
                  LEH_CHART_COLORS.series[
                    index % LEH_CHART_COLORS.series.length
                  ]!;
                return <Cell key={entry.name} fill={fill} />;
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
            {centreValue}
          </span>
          <span className="text-xs text-muted-foreground">{centreLabel}</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {segments.map((segment, index) => (
          <li
            key={segment.name}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    segment.fill ??
                    LEH_CHART_COLORS.series[
                      index % LEH_CHART_COLORS.series.length
                    ],
                }}
                aria-hidden
              />
              {segment.name}
            </span>
            <span className="font-mono text-foreground tabular-nums">
              {segment.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
