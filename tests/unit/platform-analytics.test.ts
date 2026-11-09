import { describe, expect, it } from "vitest";

import {
  buildAnalyticsDateRange,
  parseAnalyticsRangeDays,
} from "@/modules/platform-analytics/date-range";
import {
  bucketDailyCounts,
  comparePeriods,
} from "@/modules/platform-analytics/trend";

describe("platform analytics date range", () => {
  it("defaults to 30 days", () => {
    expect(parseAnalyticsRangeDays(undefined)).toBe(30);
    expect(parseAnalyticsRangeDays("7")).toBe(7);
    expect(parseAnalyticsRangeDays("90")).toBe(90);
    expect(parseAnalyticsRangeDays("14")).toBe(30);
  });

  it("builds bounded previous period", () => {
    const range = buildAnalyticsDateRange(
      7,
      new Date("2026-01-08T12:00:00.000Z"),
    );
    expect(range.days).toBe(7);
    expect(range.timeZone).toBe("Europe/London");
    expect(new Date(range.start).getTime()).toBeLessThan(
      new Date(range.end).getTime(),
    );
    expect(new Date(range.previousStart).getTime()).toBeLessThan(
      new Date(range.start).getTime(),
    );
  });
});

describe("platform analytics trend helpers", () => {
  it("compares periods with direction", () => {
    expect(comparePeriods(10, 5).direction).toBe("up");
    expect(comparePeriods(4, 8).direction).toBe("down");
    expect(comparePeriods(0, 0).direction).toBe("flat");
  });

  it("buckets timestamps into series", () => {
    const range = buildAnalyticsDateRange(
      7,
      new Date("2026-02-01T00:00:00.000Z"),
    );
    const series = bucketDailyCounts(
      ["2026-01-28T10:00:00.000Z", "2026-01-29T10:00:00.000Z"],
      range,
    );
    expect(series.length).toBeGreaterThan(0);
    expect(series.reduce((s, p) => s + p.value, 0)).toBe(2);
  });
});
