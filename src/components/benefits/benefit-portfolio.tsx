"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { MetricCard } from "@/components/platform/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  benefitClassLabel,
  classificationSummary,
  classificationBadgeVariant,
} from "@/lib/benefits/classification";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
} from "@/lib/benefits/forecast";
import {
  benefitStatusBadgeVariant,
  benefitStatusLabel,
  portfolioFilterStatuses,
} from "@/lib/benefits/status";
import type { BenefitPortfolioItem, BenefitsOverview } from "@/lib/benefits/types";

type BenefitPortfolioProps = {
  items: BenefitPortfolioItem[];
  totalCount: number;
  overview: BenefitsOverview | null;
  statusFilter: string | null;
  searchFilter: string | null;
  benefitClassFilter: string | null;
  canCreate: boolean;
};

export function BenefitPortfolio({
  items,
  totalCount,
  overview,
  statusFilter,
  searchFilter,
  benefitClassFilter,
  canCreate,
}: BenefitPortfolioProps) {
  const router = useRouter();

  const pipeline = overview?.status_pipeline ?? {};
  const awaitingValidation = overview?.awaiting_validation ?? {
    benefits: 0,
    realisation_entries: 0,
  };
  const financialYtd =
    overview?.financial_by_type?.reduce(
      (sum, row) => sum + Number(row.validated_realised_ytd ?? 0),
      0,
    ) ?? 0;
  const financialForecast =
    overview?.financial_by_type?.reduce(
      (sum, row) => sum + Number(row.approved_forecast_total ?? 0),
      0,
    ) ?? 0;

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    const status = formData.get("status")?.toString();
    const search = formData.get("search")?.toString();
    const benefitClass = formData.get("benefit_class")?.toString();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (benefitClass) params.set("benefit_class", benefitClass);
    const query = params.toString();
    router.push(query ? `/platform/benefits?${query}` : "/platform/benefits");
  }

  return (
    <div className="flex flex-col gap-6" data-testid="benefit-portfolio">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Realising" value={pipeline.realising ?? 0} />
        <MetricCard label="Approved" value={pipeline.approved ?? 0} />
        <MetricCard label="Submitted" value={pipeline.submitted ?? 0} />
        <MetricCard
          label="Awaiting validation"
          value={awaitingValidation.benefits + awaitingValidation.realisation_entries}
          hint={`${awaitingValidation.benefits} benefits · ${awaitingValidation.realisation_entries} entries`}
        />
        <MetricCard
          label="Validated YTD"
          value={formatBenefitCurrencyAmount(financialYtd, null)}
          hint="Financial portfolio (allocated)"
        />
        <MetricCard
          label="Approved forecast"
          value={formatBenefitCurrencyAmount(financialForecast, null)}
          hint={`${overview?.non_financial?.realising_or_realised ?? 0} non-financial active`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Benefit portfolio</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{totalCount} benefits</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(new FormData(event.currentTarget));
            }}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[200px]">
              <span className="text-muted-foreground">Search</span>
              <Input
                name="search"
                defaultValue={searchFilter ?? ""}
                placeholder="Number or title"
                className="min-h-11"
                data-testid="benefit-portfolio-search"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-muted-foreground">Status</span>
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                data-testid="benefit-portfolio-status"
              >
                <option value="">All statuses</option>
                {portfolioFilterStatuses().map((status) => (
                  <option key={status} value={status}>
                    {benefitStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-muted-foreground">Class</span>
              <select
                name="benefit_class"
                defaultValue={benefitClassFilter ?? ""}
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">All classes</option>
                <option value="financial">{benefitClassLabel("financial")}</option>
                <option value="non_financial">{benefitClassLabel("non_financial")}</option>
              </select>
            </label>
            <Button type="submit" variant="outline" className="min-h-11">
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">No benefits match your filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust search or filters, or register a new improvement benefit.
              </p>
              {canCreate ? (
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/platform/benefits/new">New benefit</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/platform/benefits/${item.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`benefit-portfolio-item-${item.id}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.benefit_number ? `${item.benefit_number} · ` : ""}
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {classificationSummary(
                      item.benefit_class,
                      item.financial_type,
                      item.non_financial_type,
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={classificationBadgeVariant(item.benefit_class)}>
                    {benefitClassLabel(item.benefit_class)}
                  </Badge>
                  <Badge variant={benefitStatusBadgeVariant(item.status)}>
                    {benefitStatusLabel(item.status)}
                  </Badge>
                  {item.benefit_class === "financial" ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Forecast{" "}
                      {formatBenefitCurrencyAmount(
                        item.forecast_total_amount,
                        item.reporting_currency_snapshot,
                      )}
                      · Validated{" "}
                      {formatBenefitCurrencyAmount(
                        item.validated_realised_total,
                        item.reporting_currency_snapshot,
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Target{" "}
                      {formatMeasureValue(item.forecast_total_amount, null)}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
