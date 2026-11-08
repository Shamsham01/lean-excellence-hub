import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { PlatformLeanAiCostReport } from "@/modules/platform-admin/schemas";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatGbp(value: number | null) {
  if (value === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function LeanAiCostPanel({ report }: { report: PlatformLeanAiCostReport }) {
  const reviewPercent = (report.review_target_ratio * 100).toFixed(0);

  return (
    <div className="flex flex-col gap-8" data-testid="platform-leanai-cost">
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <p>{report.disclaimer}</p>
        {report.rate_card ? (
          <p className="mt-2">
            Rate card{" "}
            <span className="font-mono text-foreground">
              {report.rate_card.version_id}
            </span>{" "}
            from {report.rate_card.source_label} ({report.rate_card.currency}{" "}
            estimates).
          </p>
        ) : (
          <p className="mt-2">No rate card covers this period.</p>
        )}
        {report.fx_reference ? (
          <p className="mt-2">
            GBP comparison uses {report.fx_reference.id} at{" "}
            {report.fx_reference.usd_to_gbp} ({report.fx_reference.source_label}).
          </p>
        ) : null}
      </div>

      <section>
        <h3 className="text-base font-semibold">Period totals</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Priced estimate (USD)</dt>
            <dd className="mt-1 font-mono text-lg">
              {formatUsd(report.totals.estimated_usd_complete)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Usage events</dt>
            <dd className="mt-1 font-mono text-lg">
              {report.totals.usage_event_count.toLocaleString("en-GB")}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Unpriced / incomplete</dt>
            <dd className="mt-1 font-mono text-lg">
              {report.totals.incomplete_or_unpriced_event_count.toLocaleString(
                "en-GB",
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">
              Failed attempts (no usage row)
            </dt>
            <dd className="mt-1 font-mono text-lg">
              {report.totals.failed_attempt_count.toLocaleString("en-GB")}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Internal review target: about {reviewPercent}% of recurring subscription
          revenue per organisation — an alert signal only, not a customer promise.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold">By organisation</h3>
        <DashboardTable
          emptyLabel="No priced usage in this period."
          headers={[
            "Organisation",
            "Events",
            "Estimate (USD)",
            "Incomplete",
            "MRR (GBP ref.)",
            `vs ${reviewPercent}%`,
          ]}
          rows={report.by_organisation.map((row) => ({
            key: row.organisation_id,
            cells: [
              <>
                <span className="font-medium">{row.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {row.code}
                </span>
              </>,
              row.usage_event_count.toLocaleString("en-GB"),
              formatUsd(row.estimated_usd_complete),
              row.incomplete_or_unpriced_event_count.toLocaleString("en-GB"),
              formatGbp(row.monthly_subscription_revenue_gbp),
              row.soft_review.incomplete_estimate ? (
                <Badge variant="warning">Incomplete</Badge>
              ) : row.soft_review.exceeds_review_target ? (
                <Badge variant="warning">
                  {formatRatio(row.soft_review.ratio)} — review
                </Badge>
              ) : (
                formatRatio(row.soft_review.ratio)
              ),
            ],
          }))}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold">By model</h3>
          <DashboardTable
            emptyLabel="No model breakdown."
            headers={["Provider / model", "Events", "USD", "Incomplete"]}
            rows={report.by_model.map((row) => ({
              key: `${row.provider}:${row.model}`,
              cells: [
                <span key="model" className="font-mono text-xs">
                  {row.provider} / {row.model}
                </span>,
                row.usage_event_count.toLocaleString("en-GB"),
                formatUsd(row.estimated_usd_complete),
                row.incomplete_or_unpriced_event_count.toLocaleString("en-GB"),
              ],
            }))}
          />
        </div>
        <div>
          <h3 className="text-base font-semibold">By workflow</h3>
          <DashboardTable
            emptyLabel="No workflow breakdown."
            headers={["Workflow", "Events", "USD", "Incomplete"]}
            rows={report.by_workflow.map((row) => ({
              key: row.workflow_key,
              cells: [
                <span key="workflow" className="font-mono text-xs">
                  {row.workflow_key}
                </span>,
                row.usage_event_count.toLocaleString("en-GB"),
                formatUsd(row.estimated_usd_complete),
                row.incomplete_or_unpriced_event_count.toLocaleString("en-GB"),
              ],
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function DashboardTable({
  emptyLabel,
  headers,
  rows,
}: {
  emptyLabel: string;
  headers: string[];
  rows: { cells: ReactNode[]; key: string }[];
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-0">
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${index}`} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
