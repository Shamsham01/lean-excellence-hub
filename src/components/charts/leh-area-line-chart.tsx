"use client";

import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
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

export type AreaLinePoint = { label: string; value: number };

export function LehAreaLineChart({
  data,
  ariaLabel,
  height = 260,
}: {
  data: AreaLinePoint[];
  ariaLabel: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const gradientId = "leh-area-gradient";

  return (
    <div
      className="w-full min-w-0"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={LEH_CHART_COLORS.accent}
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor={LEH_CHART_COLORS.accent}
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={LEH_CHART_COLORS.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
