import { describe, expect, it } from "vitest";

import {
  formatWeekCommencing,
  isoWeekFromCivilDate,
  normalizeAnalyticsTimeZone,
  zonedCivilDate,
  zonedStartOfDay,
  zonedDateTimeParts,
} from "@/modules/platform-analytics/iso-week";
import { buildAnalyticsDateRange } from "@/modules/platform-analytics/date-range";
import {
  bucketDailyCounts,
  type TrendSeriesPoint,
} from "@/modules/platform-analytics/trend";

const LONDON = "Europe/London";

describe("iso week helpers", () => {
  it("reports week 46 for 9 Nov 2026 in Europe/London", () => {
    expect(isoWeekFromCivilDate({ year: 2026, month: 11, day: 9 })).toEqual({
      weekYear: 2026,
      week: 46,
    });
    expect(formatWeekCommencing(2026, 46, LONDON)).toMatch(/^w\/c 9 Nov$/);
  });

  it("handles year boundaries between 28 Dec and 4 Jan", () => {
    expect(isoWeekFromCivilDate({ year: 2025, month: 12, day: 28 })).toEqual({
      weekYear: 2025,
      week: 52,
    });
    expect(isoWeekFromCivilDate({ year: 2025, month: 12, day: 29 })).toEqual({
      weekYear: 2026,
      week: 1,
    });
    expect(isoWeekFromCivilDate({ year: 2026, month: 1, day: 4 })).toEqual({
      weekYear: 2026,
      week: 1,
    });
  });

  it("supports ISO week 53 years", () => {
    expect(isoWeekFromCivilDate({ year: 2020, month: 12, day: 31 })).toEqual({
      weekYear: 2020,
      week: 53,
    });
    expect(isoWeekFromCivilDate({ year: 2021, month: 1, day: 3 })).toEqual({
      weekYear: 2020,
      week: 53,
    });
  });

  it("maps UTC timestamps using the organisation timezone", () => {
    expect(zonedCivilDate("2026-06-01T23:30:00.000Z", LONDON)).toEqual({
      year: 2026,
      month: 6,
      day: 2,
    });
  });

  it("rejects invalid time zones", () => {
    expect(normalizeAnalyticsTimeZone("Not/A_TimeZone")).toBe(LONDON);
    expect(normalizeAnalyticsTimeZone("Europe/London")).toBe(LONDON);
  });

  it.each([
    { timeZone: "Europe/London", date: { year: 2026, month: 3, day: 29 } },
    { timeZone: "Europe/London", date: { year: 2026, month: 10, day: 25 } },
    { timeZone: "America/New_York", date: { year: 2026, month: 3, day: 8 } },
    { timeZone: "America/Santiago", date: { year: 2026, month: 9, day: 6 } },
    {
      timeZone: "Australia/Lord_Howe",
      date: { year: 2026, month: 10, day: 4 },
    },
  ])(
    "resolves zonedStartOfDay on DST edges ($timeZone)",
    ({ timeZone, date }) => {
      const start = zonedStartOfDay(date, timeZone);
      const parts = zonedDateTimeParts(start, timeZone);
      expect(parts.year).toBe(date.year);
      expect(parts.month).toBe(date.month);
      expect(parts.day).toBe(date.day);
    },
  );

  it("builds analytics date ranges across spring-forward without crashing", () => {
    expect(() =>
      buildAnalyticsDateRange(7, new Date("2026-03-29T12:00:00.000Z"), LONDON),
    ).not.toThrow();
  });
});

describe("daily analytics buckets", () => {
  it("counts events on the last civil day of a 7-day range", () => {
    const now = new Date("2026-11-09T15:00:00.000Z");
    const range = buildAnalyticsDateRange(7, now, LONDON);
    const series = bucketDailyCounts(["2026-11-09T14:00:00.000Z"], {
      ...range,
      days: 7,
    });
    expect(series.length).toBe(8);
    expect(series.reduce((sum, point) => sum + point.value, 0)).toBe(1);
  });
});

describe("weekly analytics buckets", () => {
  it("assigns events to ISO calendar weeks with Wk labels", () => {
    const range = {
      days: 30 as const,
      start: "2026-10-05T00:00:00.000Z",
      end: "2026-11-09T18:00:00.000Z",
      timeZone: LONDON,
    };
    const series = bucketDailyCounts(
      ["2026-11-03T10:00:00.000Z", "2026-11-09T09:00:00.000Z"],
      range,
    );
    const week45 = series.find((point) => point.label === "Wk 45");
    const week46 = series.find((point) => point.label === "Wk 46");
    expect(week45?.value).toBe(1);
    expect(week46?.value).toBe(1);
    expect(week46?.tooltipLabel).toContain("w/c 9 Nov");
    expect(
      series.some((point: TrendSeriesPoint) => point.label === "Wk 1"),
    ).toBe(false);
  });
});
