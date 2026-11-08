"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  chartGridStroke,
  chartTickStyle,
  chartTooltipStyle,
  LEH_CHART_COLORS,
} from "./chart-theme";

export type BarPoint = { label: string; value: number; fill?: string };

export function LehBarChart({
  data,
  ariaLabel,
  height = 260,
}: {
  data: BarPoint[];
  ariaLabel: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  return (
    <div
      className="w-full min-w-0"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke={chartGridStroke}
            strokeDasharray="4 4"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={chartTickStyle}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={chartTickStyle}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip {...chartTooltipStyle} />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          >
            {data.map((entry, index) => {
              const fill =
                entry.fill ??
                LEH_CHART_COLORS.series[
                  index % LEH_CHART_COLORS.series.length
                ]!;
              return <Cell key={entry.label} fill={fill} />;
            })}
            <LabelList
              dataKey="value"
              position="top"
              className="fill-foreground font-mono text-[10px] tabular-nums"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
