export const ANALYTICS_RANGE_OPTIONS = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_OPTIONS)[number];

export type AnalyticsDateRange = {
  days: AnalyticsRangeDays;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
};

export function parseAnalyticsRangeDays(
  raw: string | string[] | undefined,
): AnalyticsRangeDays {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (parsed === 7 || parsed === 30 || parsed === 90) {
    return parsed;
  }
  return 30;
}

export function buildAnalyticsDateRange(
  days: AnalyticsRangeDays,
  now = new Date(),
): AnalyticsDateRange {
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const previousEnd = new Date(start);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);
  return {
    days,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}
