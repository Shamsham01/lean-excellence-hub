export type ForecastPeriodDraft = {
  periodStart: string;
  periodEnd: string;
  forecastAmount: number;
  displayOrder: number;
};

export const REALISATION_PATTERNS = ["one_off", "recurring"] as const;

export type RealisationPattern = (typeof REALISATION_PATTERNS)[number];

export function realisationPatternLabel(pattern: string): string {
  return pattern === "recurring" ? "Recurring" : "One-off";
}

export function generateRecurringPeriods(
  startDate: string,
  endDate: string,
  monthlyAmount: number,
): ForecastPeriodDraft[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const periods: ForecastPeriodDraft[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let displayOrder = 1;

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const periodEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );

    if (periodEnd > end) {
      break;
    }

    periods.push({
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: periodEnd.toISOString().slice(0, 10),
      forecastAmount: monthlyAmount,
      displayOrder,
    });

    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    displayOrder += 1;
  }

  return periods;
}

export function deriveForecastTotalFromPeriods(
  periods: ReadonlyArray<Pick<ForecastPeriodDraft, "forecastAmount">>,
): number {
  return periods.reduce((total, period) => total + period.forecastAmount, 0);
}

export function formatForecastPeriodLabel(
  periodStart: string,
  periodEnd: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(`${periodStart}T00:00:00Z`))} – ${formatter.format(new Date(`${periodEnd}T00:00:00Z`))}`;
}

export function getFiscalYearRange(
  fiscalYearStartMonth: number,
  asOfDate: string,
): { start: string; end: string } {
  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  const year =
    asOf.getUTCMonth() + 1 >= fiscalYearStartMonth
      ? asOf.getUTCFullYear()
      : asOf.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(year, fiscalYearStartMonth - 1, 1));
  const end = new Date(Date.UTC(year + 1, fiscalYearStartMonth - 1, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function formatBenefitCurrencyAmount(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount == null) {
    return "—";
  }

  const resolvedCurrency = currency ?? "GBP";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMeasureValue(
  value: number | null | undefined,
  unit?: string | null,
): string {
  if (value == null) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  return formatForecastPeriodLabel(periodStart, periodEnd);
}

export function forecastLifecycleLabel(lifecycle: string): string {
  return lifecycle
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function forecastLifecyclePresentation(lifecycle: string): string {
  return forecastLifecycleLabel(lifecycle);
}

export function forecastTotalPresentationLabel(isFinancial: boolean): string {
  return isFinancial ? "Approved Forecast" : "Target Measure";
}

export function validatedTotalPresentationLabel(isFinancial: boolean): string {
  return isFinancial ? "Validated Actual" : "Validated Measure";
}
