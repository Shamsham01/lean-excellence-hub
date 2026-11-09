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
  const rangeStartDay = addCalendarDays(today, -days);
  const previousEndDay = rangeStartDay;
  const previousStartDay = addCalendarDays(rangeStartDay, -days);
  const start = zonedStartOfDay(rangeStartDay, timeZone).toISOString();
  const previousEnd = zonedStartOfDay(previousEndDay, timeZone).toISOString();
  const previousStart = zonedStartOfDay(
    previousStartDay,
    timeZone,
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
