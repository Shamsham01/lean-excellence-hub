"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  approveBenefitForecast,
  createBenefitForecastSuccessorVersion,
  submitBenefitForecast,
} from "@/app/(platform)/platform/benefits/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
  formatPeriodLabel,
  forecastLifecycleLabel,
  forecastTotalPresentationLabel,
  realisationPatternLabel,
} from "@/lib/benefits/forecast";
import { benefitStatusBadgeVariant } from "@/lib/benefits/status";
import type {
  BenefitDetail,
  BenefitForecastVersion,
} from "@/lib/benefits/types";

type BenefitForecastPanelProps = {
  detail: BenefitDetail;
  forecastHistory: BenefitForecastVersion[];
  canManage: boolean;
  canApproveForecast: boolean;
};

export function BenefitForecastPanel({
  detail,
  forecastHistory,
  canManage,
  canApproveForecast,
}: BenefitForecastPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const isFinancial = detail.benefit_class === "financial";
  const current = detail.current_forecast;

  async function handleSubmitForecast(versionId: string) {
    const result = await submitBenefitForecast(versionId, detail.id);
    setMessage(result.error ?? "Forecast submitted");
    router.refresh();
  }

  async function handleApproveForecast(versionId: string) {
    const result = await approveBenefitForecast(versionId, detail.id);
    setMessage(result.error ?? "Forecast approved");
    router.refresh();
  }

  async function handleSuccessorVersion() {
    const result = await createBenefitForecastSuccessorVersion(detail.id);
    setMessage(result.error ?? "Successor forecast version created");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="benefit-forecast-panel">
      {current ? (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                Current forecast (v{current.version_number})
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {realisationPatternLabel(current.realisation_pattern)} ·{" "}
                {current.forecast_start_date} → {current.forecast_end_date}
              </p>
            </div>
            <Badge variant={benefitStatusBadgeVariant(current.lifecycle)}>
              {forecastLifecycleLabel(current.lifecycle)}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">
                {forecastTotalPresentationLabel(isFinancial)}
              </p>
              <p className="mt-1 text-muted-foreground tabular-nums">
                {isFinancial
                  ? formatBenefitCurrencyAmount(
                      current.forecast_total_amount,
                      detail.reporting_currency_snapshot,
                    )
                  : formatMeasureValue(
                      current.target_measure_value,
                      current.target_measure_unit,
                    )}
              </p>
            </div>
            {current.calculation_basis ? (
              <div>
                <p className="font-medium">Calculation basis</p>
                <p className="mt-1 text-muted-foreground">
                  {current.calculation_basis}
                </p>
              </div>
            ) : null}
            {current.assumptions ? (
              <div className="sm:col-span-2">
                <p className="font-medium">Assumptions</p>
                <p className="mt-1 text-muted-foreground">
                  {current.assumptions}
                </p>
              </div>
            ) : null}
            {detail.current_forecast_periods.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="mb-2 font-medium">Forecast periods</p>
                <div className="flex flex-col gap-2">
                  {detail.current_forecast_periods.map((period) => (
                    <div
                      key={period.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span>
                        {formatPeriodLabel(
                          period.period_start,
                          period.period_end,
                        )}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {isFinancial
                          ? formatBenefitCurrencyAmount(
                              period.forecast_amount,
                              detail.reporting_currency_snapshot,
                            )
                          : formatMeasureValue(
                              period.forecast_amount,
                              current.target_measure_unit,
                            )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {canManage && current.lifecycle === "draft" ? (
                <Button
                  size="sm"
                  onClick={() => handleSubmitForecast(current.id)}
                >
                  Submit forecast
                </Button>
              ) : null}
              {canApproveForecast && current.lifecycle === "submitted" ? (
                <Button
                  size="sm"
                  onClick={() => handleApproveForecast(current.id)}
                >
                  Approve forecast
                </Button>
              ) : null}
              {canManage && current.lifecycle === "approved" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSuccessorVersion()}
                >
                  New forecast version
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No forecast version linked yet. Add a draft forecast while the
            benefit is in draft.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Forecast history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {forecastHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecast versions recorded.
            </p>
          ) : (
            forecastHistory.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    Version {version.version_number} ·{" "}
                    {forecastLifecycleLabel(version.lifecycle)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {version.forecast_start_date} → {version.forecast_end_date}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {isFinancial
                    ? formatBenefitCurrencyAmount(
                        version.forecast_total_amount,
                        detail.reporting_currency_snapshot,
                      )
                    : formatMeasureValue(
                        version.target_measure_value,
                        version.target_measure_unit,
                      )}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
