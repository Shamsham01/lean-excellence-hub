import type { TrendDelta } from "./trend";

export type KpiPolarity = "higher-is-better" | "lower-is-better" | "neutral";

export type KpiStat = {
  id: string;
  label: string;
  value: string | number;
  trend?: TrendDelta;
  /** How to colour the headline value when not neutral. */
  polarity?: KpiPolarity;
  /** Stable e2e hook on the value element (legacy MetricCard ids). */
  valueTestId?: string;
};

export type AnalyticsSeriesPoint = {
  label: string;
  value: number;
  tooltipLabel?: string;
};

export type AnalyticsDonutSegment = { name: string; value: number };

export type AnalyticsAgeingRow = {
  id: string;
  label: string;
  meta?: string;
  metric: string;
  href?: string;
};

export type ModuleAnalyticsSnapshot = {
  stats: KpiStat[];
  trend: AnalyticsSeriesPoint[];
  statusBreakdown: AnalyticsDonutSegment[];
  comparisonBars: AnalyticsSeriesPoint[];
  ageingRows: AnalyticsAgeingRow[];
  hasData: boolean;
};

export const DEFAULT_KPI_POLARITY: Record<string, KpiPolarity> = {
  open: "neutral",
  created: "higher-is-better",
  overdue: "lower-is-better",
  completed: "higher-is-better",
  awaiting_review: "lower-is-better",
  implementing: "neutral",
  accepted: "higher-is-better",
  submitted: "neutral",
  past_target: "lower-is-better",
  in_flight: "neutral",
  validated: "higher-is-better",
  pending: "lower-is-better",
};
