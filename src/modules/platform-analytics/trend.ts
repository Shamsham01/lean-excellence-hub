import {
  DEFAULT_ANALYTICS_TIME_ZONE,
  formatIsoWeekAxisLabel,
  formatWeekCommencing,
  isoWeekFromCivilDate,
  isoWeekKey,
  listCivilDaysInclusive,
  listIsoWeeksBetween,
  rangeCrossesCalendarYear,
  zonedCivilDate,
  type IsoWeek,
} from "./iso-week";

export type TrendDelta = {
  current: number;
  previous: number;
  percent: number | null;
  direction: "up" | "down" | "flat";
};

export type TrendSeriesPoint = {
  label: string;
  value: number;
  tooltipLabel?: string;
};

export function comparePeriods(current: number, previous: number): TrendDelta {
  if (previous === 0) {
    if (current === 0) {
      return { current, previous, percent: 0, direction: "flat" };
    }
    return { current, previous, percent: null, direction: "up" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    current,
    previous,
    percent,
    direction: percent > 0 ? "up" : percent < 0 ? "down" : ("flat" as const),
  };
}

function bucketDailyInTimeZone(
  timestamps: string[],
  range: { start: string; end: string; days: number },
  timeZone: string,
): TrendSeriesPoint[] {
  const endMs = new Date(range.end).getTime();
  const startMs = new Date(range.start).getTime();
  const startLocal = zonedCivilDate(range.start, timeZone);
  const endLocal = zonedCivilDate(range.end, timeZone);
  const dayList = listCivilDaysInclusive(startLocal, endLocal);
  const buckets = dayList.map((day, index) => ({
    label: `Day ${index + 1}`,
    value: 0,
    dayKey: `${day.year}-${day.month}-${day.day}`,
  }));

  for (const ts of timestamps) {
    const ms = new Date(ts).getTime();
    if (ms < startMs || ms > endMs) continue;
    const key = zonedCivilDate(ts, timeZone);
    const dayKey = `${key.year}-${key.month}-${key.day}`;
    const index = buckets.findIndex((bucket) => bucket.dayKey === dayKey);
    if (index >= 0) {
      buckets[index]!.value += 1;
    }
  }

  return buckets.map(({ label, value }) => ({ label, value }));
}

function buildWeeklyBuckets(
  range: { start: string; end: string },
  timeZone: string,
): Map<string, { meta: IsoWeek; value: number }> {
  const startLocal = zonedCivilDate(range.start, timeZone);
  const endLocal = zonedCivilDate(range.end, timeZone);
  let weeks = listIsoWeeksBetween(startLocal, endLocal);
  const maxBuckets = 14;
  if (weeks.length > maxBuckets) {
    weeks = weeks.slice(-maxBuckets);
  }
  const map = new Map<string, { meta: IsoWeek; value: number }>();
  for (const week of weeks) {
    map.set(isoWeekKey(week), { meta: week, value: 0 });
  }
  return map;
}

function bucketWeeklyInTimeZone(
  timestamps: string[],
  range: { start: string; end: string; days: number },
  timeZone: string,
): TrendSeriesPoint[] {
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const startLocal = zonedCivilDate(range.start, timeZone);
  const endLocal = zonedCivilDate(range.end, timeZone);
  const crossesYear = rangeCrossesCalendarYear(startLocal, endLocal);
  const buckets = buildWeeklyBuckets(range, timeZone);

  for (const ts of timestamps) {
    const ms = new Date(ts).getTime();
    if (ms < startMs || ms > endMs) continue;
    const week = isoWeekFromCivilDate(zonedCivilDate(ts, timeZone));
    const key = isoWeekKey(week);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.value += 1;
    }
  }

  return [...buckets.values()].map(({ meta, value }) => ({
    label: formatIsoWeekAxisLabel(meta, crossesYear),
    tooltipLabel: `${formatWeekCommencing(meta.weekYear, meta.week, timeZone)} · ${formatIsoWeekAxisLabel(
      meta,
      crossesYear,
    )}`,
    value,
  }));
}

export function bucketDailyCounts(
  timestamps: string[],
  range: {
    start: string;
    end: string;
    days: number;
    timeZone?: string;
  },
  timeZone?: string,
): TrendSeriesPoint[] {
  const zone = timeZone ?? range.timeZone ?? DEFAULT_ANALYTICS_TIME_ZONE;
  if (range.days <= 7) {
    return bucketDailyInTimeZone(timestamps, range, zone);
  }
  return bucketWeeklyInTimeZone(timestamps, range, zone);
}
