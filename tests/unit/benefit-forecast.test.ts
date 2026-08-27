import { describe, expect, it } from "vitest";

import {
  deriveForecastTotalFromPeriods,
  formatForecastPeriodLabel,
  generateRecurringPeriods,
  getFiscalYearRange,
  realisationPatternLabel,
} from "@/lib/benefits/forecast";

describe("benefit forecast helpers", () => {
  it("generates recurring monthly periods", () => {
    const periods = generateRecurringPeriods("2026-01-01", "2026-03-31", 1_000);

    expect(periods).toHaveLength(3);
    expect(periods[0]).toMatchObject({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      forecastAmount: 1_000,
      displayOrder: 1,
    });
  });

  it("derives forecast totals from period drafts", () => {
    const total = deriveForecastTotalFromPeriods([
      { forecastAmount: 1_000 },
      { forecastAmount: 2_500 },
    ]);

    expect(total).toBe(3_500);
  });

  it("formats forecast period labels", () => {
    expect(formatForecastPeriodLabel("2026-01-01", "2026-01-31")).toContain(
      "2026",
    );
  });

  it("calculates fiscal year ranges", () => {
    expect(getFiscalYearRange(4, "2026-08-01")).toEqual({
      start: "2026-04-01",
      end: "2027-03-31",
    });
  });

  it("labels realisation patterns", () => {
    expect(realisationPatternLabel("recurring")).toBe("Recurring");
    expect(realisationPatternLabel("one_off")).toBe("One-off");
  });
});
