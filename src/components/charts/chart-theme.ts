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

export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: "12px",
  },
  labelStyle: { color: "var(--foreground)" },
};
