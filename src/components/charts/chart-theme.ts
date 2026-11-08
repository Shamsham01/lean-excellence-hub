/** Shared Recharts theme tokens aligned with LEH TailAdmin palette. */

export const LEH_CHART_COLORS = {
  accent: "#465FFF",
  success: "#10B981",
  warning: "#F59E0B",
  critical: "#EF4444",
  series: ["#465FFF", "#10B981", "#F59E0B", "#6366F1", "#EF4444"],
} as const;

export const chartTickStyle = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
};

export const chartGridStroke = "var(--border)";

/** Subtle column/area band behind hovered categories — not Recharts’ default grey slab. */
export const chartTooltipCursor = {
  fill: "color-mix(in oklch, var(--foreground) 8%, transparent)",
};

export const chartTooltipLineCursor = {
  stroke: "color-mix(in oklch, var(--foreground) 22%, transparent)",
  strokeWidth: 1,
};

export const chartTooltipStyle = {
  /** Recharts portals tooltips outside the chart; class hooks theme CSS. */
  wrapperClassName: "leh-recharts-tooltip",
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: "12px",
    color: "var(--card-foreground)",
  },
  labelStyle: { color: "var(--card-foreground)" },
};

/** Props spread onto Recharts `<Tooltip />` for bar charts. */
export const chartBarTooltipProps = {
  ...chartTooltipStyle,
  /** Single-series bars: theme item copy (multi-series charts omit this). */
  itemStyle: { color: "var(--card-foreground)" },
  cursor: chartTooltipCursor,
} as const;

/** Props spread onto Recharts `<Tooltip />` for line/area charts. */
export const chartLineTooltipProps = {
  ...chartTooltipStyle,
  cursor: chartTooltipLineCursor,
} as const;

/** Pie/donut — no hover band. */
export const chartPieTooltipProps = {
  ...chartTooltipStyle,
  cursor: false as const,
};
