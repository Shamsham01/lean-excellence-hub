export const ANALYTICS_RANGE_OPTIONS = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_OPTIONS)[number];

import {
  DEFAULT_ANALYTICS_TIME_ZONE,
  addCalendarDays,
  zonedCivilDate,
  zonedStartOfDay,
} from "./iso-week";

export type AnalyticsDateRange = {
  days: AnalyticsRangeDays;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  timeZone: string;
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
  timeZone = DEFAULT_ANALYTICS_TIME_ZONE,
): AnalyticsDateRange {
  const end = now.toISOString();
  const today = zonedCivilDate(end, timeZone);
  const rangeStartDay = addCalendarDays(today, -(days - 1));
  const startInstant = zonedStartOfDay(rangeStartDay, timeZone);
  const start = startInstant.toISOString();
  const windowMs = now.getTime() - startInstant.getTime();
  const previousStartDay = addCalendarDays(today, -(2 * days - 1));
  const previousStartInstant = zonedStartOfDay(previousStartDay, timeZone);
  const previousStart = previousStartInstant.toISOString();
  const previousEnd = new Date(
    previousStartInstant.getTime() + windowMs,
  ).toISOString();
  return {
    days,
    start,
    end,
    previousStart,
    previousEnd,
    timeZone,
  };
}
