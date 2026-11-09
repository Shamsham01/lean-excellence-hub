import { describe, expect, it } from "vitest";

import {
  formatWeekCommencing,
  isoWeekFromCivilDate,
  zonedCivilDate,
} from "@/modules/platform-analytics/iso-week";
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
