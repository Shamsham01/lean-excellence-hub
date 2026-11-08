import type { TrendDelta } from "./trend";

export type KpiStat = {
  id: string;
  label: string;
  value: string | number;
  trend?: TrendDelta;
  /** Stable e2e hook on the value element (legacy MetricCard ids). */
  valueTestId?: string;
};

export type AnalyticsSeriesPoint = { label: string; value: number };

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
