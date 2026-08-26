"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  createBenefitRealisationEntry,
  submitBenefitRealisationEntry,
  validateBenefitRealisationEntry,
} from "@/app/(platform)/platform/benefits/actions";
import { MetricCard } from "@/components/platform/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
  formatPeriodLabel,
  forecastTotalPresentationLabel,
  validatedTotalPresentationLabel,
} from "@/lib/benefits/forecast";
import {
  formatRealisationValue,
  formatVarianceAmount,
  realisationChartSeriesLabels,
  realisationPeriodChartLabel,
  varianceTone,
} from "@/lib/benefits/realisation";
import {
  realisationEntryStatusBadgeVariant,
  realisationEntryStatusLabel,
} from "@/lib/benefits/status";
import type {
  BenefitDetail,
  BenefitRealisationEntry,
  BenefitRealisationSummary,
} from "@/lib/benefits/types";

type BenefitRealisationPanelProps = {
  detail: BenefitDetail;
  summary: BenefitRealisationSummary | null;
  entries: BenefitRealisationEntry[];
  canRecord: boolean;
  canValidate: boolean;
};

export function BenefitRealisationPanel({
  detail,
  summary,
  entries,
  canRecord,
  canValidate,
}: BenefitRealisationPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [financialAmount, setFinancialAmount] = useState("");
  const [measureValue, setMeasureValue] = useState("");
  const [measureUnit, setMeasureUnit] = useState(detail.baseline_measure_unit ?? "");
  const [notes, setNotes] = useState("");

  const isFinancial = detail.benefit_class === "financial";
  const chartLabels = realisationChartSeriesLabels(isFinancial);

  const chartData = useMemo(
    () =>
      (summary?.periods ?? []).map((period) => ({
        label: realisationPeriodChartLabel(period.period_start, period.period_end),
        forecast: Number(period.forecast_amount),
        validated: Number(period.validated_amount),
      })),
    [summary?.periods],
  );

  async function handleCreateEntry() {
    if (!periodStart || !periodEnd) {
      setMessage("Period start and end are required");
      return;
    }
    const result = await createBenefitRealisationEntry({
      benefitId: detail.id,
      periodStart,
      periodEnd,
      ...(isFinancial && financialAmount.trim()
        ? { financialAmount: Number(financialAmount) }
        : {}),
      ...(!isFinancial && measureValue.trim()
        ? {
            measureValue: Number(measureValue),
            ...(measureUnit.trim() ? { measureUnit: measureUnit.trim() } : {}),
          }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setMessage(result.error ?? "Realisation entry recorded");
    if (!result.error) {
      setPeriodStart("");
      setPeriodEnd("");
      setFinancialAmount("");
      setMeasureValue("");
      setNotes("");
    }
    router.refresh();
  }

  async function handleSubmitEntry(entryId: string) {
    const result = await submitBenefitRealisationEntry(entryId, detail.id);
    setMessage(result.error ?? "Entry submitted for validation");
    router.refresh();
  }

  async function handleValidateEntry(entryId: string) {
    const result = await validateBenefitRealisationEntry(entryId, detail.id);
    setMessage(result.error ?? "Entry validated as actual");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="benefit-realisation-panel">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label={forecastTotalPresentationLabel(isFinancial)}
            value={
              isFinancial
                ? formatBenefitCurrencyAmount(
                    summary.totals.forecast_total,
                    detail.reporting_currency_snapshot,
                  )
                : formatMeasureValue(summary.totals.forecast_total, detail.baseline_measure_unit)
            }
          />
          <MetricCard
            label={validatedTotalPresentationLabel(isFinancial)}
            value={
              isFinancial
                ? formatBenefitCurrencyAmount(
                    summary.totals.validated_total,
                    detail.reporting_currency_snapshot,
                  )
                : formatMeasureValue(
                    summary.totals.validated_total,
                    detail.baseline_measure_unit,
                  )
            }
          />
          <MetricCard
            label="Variance"
            value={formatVarianceAmount(
              summary.totals.variance_total,
              isFinancial,
              detail.reporting_currency_snapshot,
              detail.baseline_measure_unit,
            )}
            hint={
              varianceTone(summary.totals.variance_total) === "positive"
                ? "Ahead of forecast"
                : varianceTone(summary.totals.variance_total) === "negative"
                  ? "Behind forecast"
                  : "On forecast"
            }
          />
        </div>
      ) : null}

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Forecast vs validated actual</CardTitle>
            <p className="text-sm text-muted-foreground">
              Bars show forecast; line shows validated actual by period.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full" role="img" aria-label="Forecast versus validated actual chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      const numeric = typeof value === "number" ? value : Number(value ?? 0);
                      return [
                        isFinancial
                          ? formatBenefitCurrencyAmount(
                              numeric,
                              detail.reporting_currency_snapshot,
                            )
                          : formatMeasureValue(numeric, detail.baseline_measure_unit),
                        String(name),
                      ];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="forecast"
                    name={chartLabels.forecast}
                    fill="var(--chart-2)"
                    fillOpacity={0.35}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="validated"
                    name={chartLabels.validated}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canRecord &&
      ["approved", "realising", "realised"].includes(detail.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Record realisation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Period start</span>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Period end</span>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
            {isFinancial ? (
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span>Financial amount</span>
                <Input
                  type="number"
                  value={financialAmount}
                  onChange={(e) => setFinancialAmount(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Measure value</span>
                  <Input
                    type="number"
                    value={measureValue}
                    onChange={(e) => setMeasureValue(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Measure unit</span>
                  <Input value={measureUnit} onChange={(e) => setMeasureUnit(e.target.value)} />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Notes</span>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Button size="sm" className="sm:col-span-2" onClick={() => handleCreateEntry()}>
              Record entry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Realisation entries</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No realisation entries yet.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatPeriodLabel(entry.period_start, entry.period_end)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatRealisationValue(
                      isFinancial,
                      entry.financial_amount,
                      entry.measure_value,
                      entry.measure_unit,
                      detail.reporting_currency_snapshot,
                    )}
                    {entry.notes ? ` · ${entry.notes}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={realisationEntryStatusBadgeVariant(entry.status)}>
                    {realisationEntryStatusLabel(entry.status)}
                  </Badge>
                  {canRecord && entry.status === "draft" ? (
                    <Button size="sm" variant="outline" onClick={() => handleSubmitEntry(entry.id)}>
                      Submit
                    </Button>
                  ) : null}
                  {canValidate && entry.status === "submitted" ? (
                    <Button size="sm" onClick={() => handleValidateEntry(entry.id)}>
                      Validate actual
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
