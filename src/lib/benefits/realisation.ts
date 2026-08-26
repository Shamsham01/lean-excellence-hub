import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
  formatPeriodLabel,
} from "@/lib/benefits/forecast";
import { realisationEntryStatusLabel as statusRealisationEntryStatusLabel } from "@/lib/benefits/status";

export type RealisationAmountEntry = {
  financialAmount?: number | null;
  measureValue?: number | null;
  status?: string;
};

export function applyPortfolioAllocation(
  amount: number,
  allocationPercentage: number,
): number {
  return (amount * allocationPercentage) / 100;
}

export function computeCumulativeRealised(
  entries: ReadonlyArray<Pick<RealisationAmountEntry, "financialAmount" | "status">>,
): number {
  return entries.reduce((total, entry) => {
    if (entry.status && entry.status !== "validated") {
      return total;
    }

    return total + (entry.financialAmount ?? 0);
  }, 0);
}

export function formatVariance(
  forecastAmount: number,
  realisedAmount: number,
): { value: number; direction: "over" | "under" | "on_target" } {
  const value = realisedAmount - forecastAmount;

  if (Math.abs(value) < 0.01) {
    return { value: 0, direction: "on_target" };
  }

  return {
    value,
    direction: value > 0 ? "over" : "under",
  };
}

export function realisationEntryStatusLabel(status: string): string {
  return statusRealisationEntryStatusLabel(status);
}

export function formatVarianceAmount(
  variance: number | null | undefined,
  isFinancial: boolean,
  currency?: string | null,
  measureUnit?: string | null,
): string {
  if (variance == null || Number.isNaN(variance)) return "—";
  const prefix = variance > 0 ? "+" : "";
  if (isFinancial) {
    return `${prefix}${formatBenefitCurrencyAmount(variance, currency ?? undefined)}`;
  }
  return `${prefix}${formatMeasureValue(variance, measureUnit ?? undefined)}`;
}

export function varianceTone(
  variance: number | null | undefined,
): "positive" | "negative" | "neutral" {
  if (variance == null || variance === 0) return "neutral";
  return variance > 0 ? "positive" : "negative";
}

export function realisationPeriodChartLabel(periodStart: string, periodEnd: string): string {
  return formatPeriodLabel(periodStart, periodEnd);
}

export function realisationChartSeriesLabels(isFinancial: boolean): {
  forecast: string;
  validated: string;
} {
  return isFinancial
    ? { forecast: "Forecast", validated: "Validated actual" }
    : { forecast: "Forecast target", validated: "Validated actual" };
}

export function formatRealisationValue(
  isFinancial: boolean,
  financialAmount: number | null | undefined,
  measureValue: number | null | undefined,
  measureUnit?: string | null,
  currency?: string | null,
): string {
  if (isFinancial) {
    return formatBenefitCurrencyAmount(financialAmount, currency ?? undefined);
  }
  return formatMeasureValue(measureValue, measureUnit ?? undefined);
}
