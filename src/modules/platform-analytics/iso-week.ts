export const DEFAULT_ANALYTICS_TIME_ZONE = "Europe/London";

export function normalizeAnalyticsTimeZone(
  timeZone: string | null | undefined,
): string {
  const candidate = timeZone?.trim();
  if (!candidate) {
    return DEFAULT_ANALYTICS_TIME_ZONE;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_ANALYTICS_TIME_ZONE;
  }
}

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

export type IsoWeek = {
  weekYear: number;
  week: number;
};

export type ZonedDateTimeParts = CivilDate & {
  hour: number;
  minute: number;
  second: number;
};

type PartMap = Record<string, string>;

function partsMap(formatter: Intl.DateTimeFormat, date: Date): PartMap {
  const map: PartMap = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return map;
}

export function zonedDateTimeParts(
  date: Date,
  timeZone: string,
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = partsMap(formatter, date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function zonedCivilDate(isoUtc: string, timeZone: string): CivilDate {
  const { year, month, day } = zonedDateTimeParts(new Date(isoUtc), timeZone);
  return { year, month, day };
}

export function addCalendarDays(date: CivilDate, offset: number): CivilDate {
  const anchor = new Date(Date.UTC(date.year, date.month - 1, date.day));
  anchor.setUTCDate(anchor.getUTCDate() + offset);
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  };
}

function civilDateMatches(parts: ZonedDateTimeParts, date: CivilDate): boolean {
  return (
    parts.year === date.year &&
    parts.month === date.month &&
    parts.day === date.day
  );
}

/** Milliseconds that must be subtracted from UTC to obtain local civil time. */
export function timeZoneOffsetMilliseconds(at: Date, timeZone: string): number {
  const local = zonedDateTimeParts(at, timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return asUtc - at.getTime();
}

function earliestInstantOnLocalCivilDay(
  date: CivilDate,
  timeZone: string,
): number | null {
  const nominal = Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0);
  let earliest: number | null = null;
  for (let offsetHours = -18; offsetHours <= 36; offsetHours++) {
    for (let minute = 0; minute < 60; minute++) {
      const candidate = nominal + offsetHours * 3_600_000 + minute * 60_000;
      const parts = zonedDateTimeParts(new Date(candidate), timeZone);
      if (civilDateMatches(parts, date)) {
        if (earliest === null || candidate < earliest) {
          earliest = candidate;
        }
      }
    }
  }
  return earliest;
}

/**
 * UTC instant at local 00:00 when it exists; otherwise the first instant of
 * that civil day (spring-forward gaps).
 */
export function zonedStartOfDay(date: CivilDate, timeZone: string): Date {
  const zone = normalizeAnalyticsTimeZone(timeZone);
  let guess = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  for (let attempt = 0; attempt < 4; attempt++) {
    const offset = timeZoneOffsetMilliseconds(new Date(guess), zone);
    guess = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0) - offset;
  }

  const atGuess = zonedDateTimeParts(new Date(guess), zone);
  if (
    civilDateMatches(atGuess, date) &&
    atGuess.hour === 0 &&
    atGuess.minute === 0
  ) {
    return new Date(guess);
  }

  const earliest = earliestInstantOnLocalCivilDay(date, zone);
  if (earliest === null) {
    throw new Error(
      `Could not resolve start of ${date.year}-${date.month}-${date.day} in ${zone}`,
    );
  }
  return new Date(earliest);
}

/** ISO week from a civil calendar date (proleptic Gregorian). */
export function isoWeekFromCivilDate(date: CivilDate): IsoWeek {
  const temp = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const weekYear = temp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(
    ((temp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { weekYear, week };
}

export function isoWeekKey(week: IsoWeek): string {
  return `${week.weekYear}-W${week.week.toString().padStart(2, "0")}`;
}

export function mondayOfIsoWeek(weekYear: number, week: number): CivilDate {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return {
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth() + 1,
    day: monday.getUTCDate(),
  };
}

export function formatWeekCommencing(
  weekYear: number,
  week: number,
  timeZone = DEFAULT_ANALYTICS_TIME_ZONE,
): string {
  const monday = mondayOfIsoWeek(weekYear, week);
  const instant = zonedStartOfDay(monday, timeZone);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone,
  });
  return `w/c ${formatter.format(instant)}`;
}

export function formatIsoWeekAxisLabel(
  week: IsoWeek,
  rangeCrossesCalendarYear: boolean,
): string {
  if (rangeCrossesCalendarYear) {
    const yy = String(week.weekYear).slice(-2);
    return `Wk ${week.week} '${yy}`;
  }
  return `Wk ${week.week}`;
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

export function listCivilDaysInclusive(
  start: CivilDate,
  end: CivilDate,
): CivilDate[] {
  const days: CivilDate[] = [];
  let cursor = start;
  while (compareCivilDates(cursor, end) <= 0) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

export function listIsoWeeksBetween(
  start: CivilDate,
  end: CivilDate,
): IsoWeek[] {
  const seen = new Set<string>();
  const weeks: IsoWeek[] = [];
  let cursor = start;
  while (
    cursor.year < end.year ||
    (cursor.year === end.year &&
      (cursor.month < end.month ||
        (cursor.month === end.month && cursor.day <= end.day)))
  ) {
    const week = isoWeekFromCivilDate(cursor);
    const key = isoWeekKey(week);
    if (!seen.has(key)) {
      seen.add(key);
      weeks.push(week);
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return weeks;
}

export function rangeCrossesCalendarYear(
  start: CivilDate,
  end: CivilDate,
): boolean {
  return start.year !== end.year;
}
